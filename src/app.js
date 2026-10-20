import express from "express";
import "dotenv/config";
import helmet from "helmet";
import cors from "cors";
import { connectToDatabase, sanitizeMongoUri, getDatabase } from "./mongodb.js";
import { ensureDemoAccount } from "./demo.js";
import authRoutes from "./routes/authRoutes.js";
import urlRoutes from "./routes/urlRoutes.js";
import errorHandler from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

import { setupSwagger } from "./config/swagger.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Render (and most hosts) sit behind one reverse proxy. Trusting it makes req.ip the real
// client IP (so rate limiting is per visitor, not one shared bucket) and req.protocol
// "https" (so generated short URLs use https).
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));

// Mount Swagger UI at /api-docs (before rate limiter)
setupSwagger(app);

app.get("/", (req, res) => {
  res.json({ message: "URL Shortener API is running" });
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: System health check
 *     description: Returns the health status of the application.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Application is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheckResponse'
 */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/**
 * @openapi
 * /health/db:
 *   get:
 *     summary: Database health check
 *     description: Pings MongoDB. Used by the scheduled keep-alive job so the free Render
 *       service and the free MongoDB Atlas cluster both see regular activity.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Application and database are healthy
 *       503:
 *         description: Database is unreachable
 */
app.get("/health/db", async (req, res) => {
  try {
    await getDatabase().command({ ping: 1 });
    res.status(200).json({ status: "ok", database: "ok" });
  } catch {
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

// Apply rate limiting exclusively to /api routes
app.use("/api", apiLimiter);

app.use(authRoutes);
app.use(urlRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectToDatabase();
    await ensureDemoAccount();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    const sanitizedUri = sanitizeMongoUri(process.env.MONGODB_URI);
    console.error(`Failed to connect to MongoDB (${sanitizedUri}):`);
    console.error(error.stack || error);
    if (error.cause) {
      console.error("Underlying Cause:", error.cause);
    }
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export default app;
