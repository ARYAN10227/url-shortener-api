import express from "express";
import "dotenv/config";
import helmet from "helmet";
import cors from "cors";
import { connectToDatabase, sanitizeMongoUri } from "./mongodb.js";
import authRoutes from "./routes/authRoutes.js";
import urlRoutes from "./routes/urlRoutes.js";
import errorHandler from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

import { setupSwagger } from "./config/swagger.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

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

// Apply rate limiting exclusively to /api routes
app.use("/api", apiLimiter);

app.use(authRoutes);
app.use(urlRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectToDatabase();

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
