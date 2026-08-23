import { getDatabase } from "../mongodb.js";
import { generateShortCode } from "../utils/generateShortCode.js";
import { validateOriginalUrl, validateCustomShortCode } from "../utils/validateUrl.js";
import { parseUrlQuery } from "../utils/parseUrlQuery.js";
import { parseAnalyticsQuery } from "../utils/parseAnalyticsQuery.js";

export async function createShortUrl(req, res, next) {
  const originalUrl = req.body?.originalUrl;
  const customShortCode = req.body?.shortCode;
  const userId = req.user._id;

  const urlValidationError = validateOriginalUrl(originalUrl);
  if (urlValidationError) {
    return res.status(400).json({
      error: urlValidationError,
    });
  }

  const database = getDatabase();

  // If a custom short code is provided by the client
  if (customShortCode !== undefined && customShortCode !== null) {
    const codeValidationError = validateCustomShortCode(customShortCode);
    if (codeValidationError) {
      return res.status(400).json({
        error: codeValidationError,
      });
    }

    const trimmedCode = customShortCode.trim();
    const url = {
      originalUrl,
      shortCode: trimmedCode,
      userId,
      createdAt: new Date(),
      clicks: 0,
    };

    try {
      const result = await database.collection("urls").insertOne(url);
      const shortUrl = `${req.protocol}://${req.get("host")}/${trimmedCode}`;

      return res.status(201).json({
        _id: result.insertedId,
        ...url,
        shortUrl,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          error: "Short code already exists.",
        });
      }
      return next(error);
    }
  }

  // Auto-generate a random short code if no custom short code was provided
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const shortCode = generateShortCode();
    const url = {
      originalUrl,
      shortCode,
      userId,
      createdAt: new Date(),
      clicks: 0,
    };

    try {
      const result = await database.collection("urls").insertOne(url);
      const shortUrl = `${req.protocol}://${req.get("host")}/${shortCode}`;

      return res.status(201).json({
        _id: result.insertedId,
        ...url,
        shortUrl,
      });
    } catch (error) {
      if (error.code === 11000) {
        // Collision detected, retry with a new shortCode
        continue;
      }
      return next(error);
    }
  }

  return next(new Error("Could not generate a unique short code. Please try again."));
}

export async function getAllUrls(req, res, next) {
  const { page, limit, sortBy, order, minClicks, search, error } = parseUrlQuery(req.query);

  if (error) {
    return res.status(400).json({
      error,
    });
  }

  try {
    const database = getDatabase();
    const collection = database.collection("urls");

    const query = { userId: req.user._id };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { originalUrl: { $regex: escapedSearch, $options: "i" } },
        { shortCode: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    if (minClicks !== null) {
      query.clicks = { $gte: minClicks };
    }

    const sortOrder = order === "asc" ? 1 : -1;
    const sortSpec = { [sortBy]: sortOrder };

    const skip = (page - 1) * limit;

    const [urls, total] = await Promise.all([
      collection
        .find(query)
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.json({
      urls,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getUrlDetails(req, res, next) {
  const { shortCode } = req.params;

  try {
    const database = getDatabase();
    const urlDocument = await database.collection("urls").findOne({ shortCode });

    if (!urlDocument) {
      return res.status(404).json({
        error: "Short URL not found.",
      });
    }

    if (!urlDocument.userId || urlDocument.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: "Forbidden: You do not own this URL.",
      });
    }

    return res.json(urlDocument);
  } catch (error) {
    next(error);
  }
}

export async function getUrlAnalytics(req, res, next) {
  const { shortCode } = req.params;
  const { limit, fromDate, toDate, error } = parseAnalyticsQuery(req.query);

  if (error) {
    return res.status(400).json({
      error,
    });
  }

  try {
    const database = getDatabase();
    const urlDocument = await database.collection("urls").findOne({ shortCode });

    if (!urlDocument) {
      return res.status(404).json({
        error: "Short URL not found.",
      });
    }

    if (!urlDocument.userId || urlDocument.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: "Forbidden: You do not own this URL.",
      });
    }

    const clickFilter = { shortCode };

    if (fromDate || toDate) {
      clickFilter.clickedAt = {};
      if (fromDate) {
        clickFilter.clickedAt.$gte = fromDate;
      }
      if (toDate) {
        clickFilter.clickedAt.$lte = toDate;
      }
    }

    const clicksCollection = database.collection("clicks");

    const [clickHistory, filteredClicks] = await Promise.all([
      clicksCollection
        .find(clickFilter)
        .sort({ clickedAt: -1 })
        .limit(limit)
        .project({ _id: 0, clickedAt: 1 })
        .toArray(),
      clicksCollection.countDocuments(clickFilter),
    ]);

    return res.json({
      shortCode: urlDocument.shortCode,
      originalUrl: urlDocument.originalUrl,
      clicks: urlDocument.clicks,
      filteredClicks,
      createdAt: urlDocument.createdAt,
      clickHistory,
    });
  } catch (error) {
    next(error);
  }
}

export async function redirectToOriginalUrl(req, res, next) {
  const { shortCode } = req.params;

  try {
    const database = getDatabase();
    const urlDocument = await database.collection("urls").findOneAndUpdate(
      { shortCode },
      { $inc: { clicks: 1 } }
    );

    if (!urlDocument) {
      return res.status(404).json({
        error: "Short URL not found.",
      });
    }

    await database.collection("clicks").insertOne({
      urlId: urlDocument._id,
      shortCode,
      clickedAt: new Date(),
    });

    return res.redirect(urlDocument.originalUrl);
  } catch (error) {
    next(error);
  }
}

export async function deleteUrl(req, res, next) {
  const { shortCode } = req.params;

  try {
    const database = getDatabase();

    // 1. Find the URL document to verify existence and ownership
    const urlDocument = await database.collection("urls").findOne({ shortCode });

    if (!urlDocument) {
      return res.status(404).json({
        error: "Short URL not found.",
      });
    }

    if (!urlDocument.userId || urlDocument.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: "Forbidden: You do not own this URL.",
      });
    }

    // 2. Cascade delete associated click records from clicks collection using urlId
    await database.collection("clicks").deleteMany({ urlId: urlDocument._id });

    // 3. Delete the URL document from urls collection
    await database.collection("urls").deleteOne({ _id: urlDocument._id });

    return res.status(200).json({
      message: "Short URL deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUrl(req, res, next) {
  const { shortCode } = req.params;
  const { originalUrl, shortCode: newShortCode } = req.body || {};

  if (
    (originalUrl === undefined || originalUrl === null) &&
    (newShortCode === undefined || newShortCode === null)
  ) {
    return res.status(400).json({
      error: "At least one field (originalUrl or shortCode) must be provided for update.",
    });
  }

  const updates = {};

  if (originalUrl !== undefined && originalUrl !== null) {
    const urlValidationError = validateOriginalUrl(originalUrl);
    if (urlValidationError) {
      return res.status(400).json({
        error: urlValidationError,
      });
    }
    updates.originalUrl = originalUrl;
  }

  let trimmedNewCode = null;
  if (newShortCode !== undefined && newShortCode !== null) {
    const codeValidationError = validateCustomShortCode(newShortCode);
    if (codeValidationError) {
      return res.status(400).json({
        error: codeValidationError,
      });
    }
    trimmedNewCode = newShortCode.trim();
    updates.shortCode = trimmedNewCode;
  }

  try {
    const database = getDatabase();

    const existingUrl = await database.collection("urls").findOne({ shortCode });
    if (!existingUrl) {
      return res.status(404).json({
        error: "Short URL not found.",
      });
    }

    if (!existingUrl.userId || existingUrl.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: "Forbidden: You do not own this URL.",
      });
    }

    const updatedDocument = await database.collection("urls").findOneAndUpdate(
      { _id: existingUrl._id },
      { $set: updates },
      { returnDocument: "after" }
    );

    // Synchronize click history records if shortCode changed
    if (trimmedNewCode && trimmedNewCode !== shortCode) {
      await database
        .collection("clicks")
        .updateMany(
          { urlId: updatedDocument._id },
          { $set: { shortCode: trimmedNewCode } }
        );
    }

    return res.status(200).json(updatedDocument);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Short code already exists.",
      });
    }
    next(error);
  }
}
