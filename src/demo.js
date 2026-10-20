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

/**
 * Creates the demo user if missing (and resets its password to DEMO_PASSWORD).
 * If the demo account has no links left, re-seeds a few sample links with click history
 * spread over the last 7 days so the dashboard and analytics never look empty.
 * Returns the demo user document, or null when the demo is disabled.
 */
export async function ensureDemoAccount() {
  if (!isDemoEnabled()) return null;

  const database = getDatabase();
  const users = database.collection("users");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await users.updateOne(
    { email: DEMO_EMAIL },
    {
      $set: { name: DEMO_NAME, passwordHash, isDemo: true },
      $setOnInsert: { email: DEMO_EMAIL, createdAt: new Date() },
    },
    { upsert: true }
  );
  const user = await users.findOne({ email: DEMO_EMAIL });

  const urls = database.collection("urls");
  const existing = await urls.countDocuments({ userId: user._id });
  if (existing > 0) return user;

  const now = Date.now();
  for (const link of SAMPLE_LINKS) {
    // A sample code may already belong to someone else; skip it rather than fail.
    const taken = await urls.findOne({ shortCode: link.shortCode });
    if (taken) continue;

    const createdAt = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const { insertedId } = await urls.insertOne({
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      userId: user._id,
      createdAt,
      clicks: link.clicks,
    });

    const clicks = Array.from({ length: link.clicks }, () => ({
      urlId: insertedId,
      shortCode: link.shortCode,
      clickedAt: new Date(now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
    }));
    if (clicks.length) await database.collection("clicks").insertMany(clicks);
  }

  return user;
}
