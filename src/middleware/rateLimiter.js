import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // Max 300 requests per 15 minutes per client IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests. Please try again later.",
    });
  },
});
