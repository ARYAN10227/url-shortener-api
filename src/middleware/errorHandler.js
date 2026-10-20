export default function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  // Malformed JSON or an oversized body is the client's fault, not a server error.
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }

  console.error(error);

  return res.status(500).json({
    error: "Internal server error.",
  });
}
