import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDatabase } from "../mongodb.js";
import { ensureDemoAccount, isDemoEnabled, isDemoUser } from "../demo.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getJwtSecret() {
  return process.env.JWT_SECRET || (process.env.NODE_ENV === "test" ? "test_jwt_secret" : null);
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || "7d";
}

export async function register(req, res, next) {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: "Name is required.",
    });
  }

  if (!email || typeof email !== "string" || !email.trim()) {
    return res.status(400).json({
      error: "Email is required.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      error: "Invalid email format.",
    });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({
      error: "Password must be at least 6 characters long.",
    });
  }

  if (isDemoUser(normalizedEmail)) {
    return res.status(409).json({
      error: "This email belongs to the shared demo account. Use \"Try the demo\" or choose another email.",
    });
  }

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return res.status(500).json({
      error: "JWT_SECRET is not configured on the server.",
    });
  }

  try {
    const database = getDatabase();
    const usersCollection = database.collection("users");

    const existingUser = await usersCollection.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        error: "Email already registered.",
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const trimmedName = name.trim();
    const createdAt = new Date();

    const newUserDoc = {
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      createdAt,
    };

    const result = await usersCollection.insertOne(newUserDoc);
    const userId = result.insertedId.toString();

    const token = jwt.sign(
      {
        userId,
        email: normalizedEmail,
        name: trimmedName,
      },
      jwtSecret,
      { expiresIn: getJwtExpiresIn() }
    );

    return res.status(201).json({
      message: "User registered successfully.",
      token,
      user: {
        _id: result.insertedId,
        name: trimmedName,
        email: normalizedEmail,
        createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Email already registered.",
      });
    }
    next(error);
  }
}

export async function login(req, res, next) {
  const { email, password } = req.body || {};

  if (!email || typeof email !== "string" || !email.trim()) {
    return res.status(400).json({
      error: "Email is required.",
    });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({
      error: "Password is required.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return res.status(500).json({
      error: "JWT_SECRET is not configured on the server.",
    });
  }

  try {
    const database = getDatabase();
    const usersCollection = database.collection("users");

    const user = await usersCollection.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const userId = user._id.toString();
    const token = jwt.sign(
      {
        userId,
        email: user.email,
        name: user.name,
      },
      jwtSecret,
      { expiresIn: getJwtExpiresIn() }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const database = getDatabase();
    const user = await database.collection("users").findOne({ _id: req.user._id });

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    return res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function demoLogin(req, res, next) {
  if (!isDemoEnabled()) {
    return res.status(404).json({
      error: "Demo login is disabled.",
    });
  }

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return res.status(500).json({
      error: "JWT_SECRET is not configured on the server.",
    });
  }

  try {
    // Re-creates the demo account and sample links if they were deleted.
    const user = await ensureDemoAccount();
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
      },
      jwtSecret,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      message: "Logged in to the demo account.",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
