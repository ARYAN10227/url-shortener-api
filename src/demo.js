import bcrypt from "bcryptjs";
import { getDatabase } from "./mongodb.js";

/**
 * A shared, public demo account so recruiters and interviewers can try the app
 * without registering. Credentials are intentionally public; disable with DEMO_ENABLED=false.
 */
export const DEMO_EMAIL = (process.env.DEMO_EMAIL || "demo@urlshortener.dev").toLowerCase();
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo1234";
export const DEMO_NAME = "Demo User";

export function isDemoEnabled() {
  return process.env.DEMO_ENABLED !== "false";
}

const SAMPLE_LINKS = [
  { shortCode: "demo-github", originalUrl: "https://github.com/ARYAN10227", clicks: 42 },
  { shortCode: "demo-clickpipe", originalUrl: "https://github.com/ARYAN10227/clickstream-pipeline", clicks: 27 },
  { shortCode: "demo-video", originalUrl: "https://youtu.be/em_TnU8WQkU", clicks: 15 },
  { shortCode: "demo-linkedin", originalUrl: "https://linkedin.com/in/aryan-raj-2b3868340", clicks: 9 },
];

export const DEMO_MAX_LINKS = Number(process.env.DEMO_MAX_LINKS || 20);

export function isDemoUser(email) {
  return isDemoEnabled() && typeof email === "string" && email.toLowerCase() === DEMO_EMAIL;
}

let cachedHash = null;
async function demoPasswordHash() {
  // bcrypt is deliberately slow; hash once per process, not on every demo login.
  if (!cachedHash) cachedHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return cachedHash;
}

/**
 * Creates the demo user if missing. With resetPassword (used at startup) it also resets
 * the password to DEMO_PASSWORD, in case it was ever changed in the database.
 * If the demo account has no links left, re-seeds a few sample links with click history
 * spread over the last 7 days so the dashboard and analytics never look empty.
 * Safe to call concurrently. Returns the demo user document, or null when disabled.
 */
export async function ensureDemoAccount({ resetPassword = false } = {}) {
  if (!isDemoEnabled()) return null;

  const database = getDatabase();
  const users = database.collection("users");
  const passwordHash = await demoPasswordHash();

  const update = {
    $set: { name: DEMO_NAME, isDemo: true },
    $setOnInsert: { email: DEMO_EMAIL, createdAt: new Date() },
  };
  if (resetPassword) update.$set.passwordHash = passwordHash;
  else update.$setOnInsert.passwordHash = passwordHash;

  try {
    await users.updateOne({ email: DEMO_EMAIL }, update, { upsert: true });
  } catch (error) {
    // Two first-ever demo logins at the same moment: one upsert wins, the other hits the
    // unique email index. The user exists either way.
    if (error.code !== 11000) throw error;
  }
  const user = await users.findOne({ email: DEMO_EMAIL });

  const urls = database.collection("urls");
  const existing = await urls.countDocuments({ userId: user._id });
  if (existing > 0) return user;

  const now = Date.now();
  for (const link of SAMPLE_LINKS) {
    const createdAt = new Date(now - 7 * 24 * 60 * 60 * 1000);
    let insertedId;
    try {
      ({ insertedId } = await urls.insertOne({
        originalUrl: link.originalUrl,
        shortCode: link.shortCode,
        userId: user._id,
        createdAt,
        clicks: link.clicks,
      }));
    } catch (error) {
      // The code is taken (by another user, or by a concurrent seed): skip it.
      if (error.code === 11000) continue;
      throw error;
    }

    const clicks = Array.from({ length: link.clicks }, () => ({
      urlId: insertedId,
      shortCode: link.shortCode,
      clickedAt: new Date(now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
    }));
    if (clicks.length) await database.collection("clicks").insertMany(clicks);
  }

  return user;
}

/**
 * The demo account is shared and public, so keep it small: after a new link is added,
 * delete the oldest links (and their clicks) beyond DEMO_MAX_LINKS. Returns how many
 * links were removed.
 */
export async function enforceDemoLinkCap(userId) {
  const database = getDatabase();
  const urls = database.collection("urls");
  const extra = await urls
    .find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .skip(DEMO_MAX_LINKS)
    .project({ _id: 1 })
    .toArray();
  if (extra.length === 0) return 0;

  const ids = extra.map((doc) => doc._id);
  await database.collection("clicks").deleteMany({ urlId: { $in: ids } });
  await urls.deleteMany({ _id: { $in: ids } });
  return ids.length;
}
