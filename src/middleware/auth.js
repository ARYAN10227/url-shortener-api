import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Authentication token required.",
    });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      error: "Invalid authorization format. Format must be 'Bearer <token>'.",
    });
  }

  const token = parts[1];
  const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === "test" ? "test_jwt_secret" : null);

  if (!jwtSecret) {
    return res.status(500).json({
      error: "JWT_SECRET is not configured on the server.",
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        error: "Invalid authentication token payload.",
      });
    }

    req.user = {
      _id: new ObjectId(decoded.userId),
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Authentication token has expired. Please log in again.",
      });
    }
    return res.status(401).json({
      error: "Invalid authentication token.",
    });
  }
}
