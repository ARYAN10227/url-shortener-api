import { MongoClient } from "mongodb";

let client;
let database;

export async function connectToDatabase(overrideDbName) {
  const connectionString = process.env.MONGODB_URI;

  if (!connectionString) {
    throw new Error("MONGODB_URI is not set. Add it to your .env file.");
  }

  const dbName =
    overrideDbName ||
    (process.env.NODE_ENV === "test"
      ? "url_shortener_test"
      : process.env.MONGODB_DB_NAME || "url_shortener");

  client = new MongoClient(connectionString);

  await client.connect();
  database = client.db(dbName);

  // Create indexes for query optimization and uniqueness enforcement
  const urlsCollection = database.collection("urls");
  await urlsCollection.createIndexes([
    { key: { shortCode: 1 }, name: "shortCode_1", unique: true },
    { key: { createdAt: -1 }, name: "createdAt_-1" },
    { key: { clicks: -1 }, name: "clicks_-1" },
  ]);

  const clicksCollection = database.collection("clicks");
  await clicksCollection.createIndexes([
    { key: { shortCode: 1, clickedAt: -1 }, name: "shortCode_1_clickedAt_-1" },
    { key: { urlId: 1, clickedAt: -1 }, name: "urlId_1_clickedAt_-1" },
  ]);

  console.log(`Connected to MongoDB (${dbName}) and verified indexes`);
}

export function getDatabase() {
  if (!database) {
    throw new Error("Database is not connected yet.");
  }

  return database;
}

export async function closeDatabaseConnection() {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}
