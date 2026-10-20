export function validateOriginalUrl(originalUrl) {
  if (typeof originalUrl !== "string" || originalUrl.trim() === "") {
    return "originalUrl is required and cannot be empty.";
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(originalUrl);
  } catch {
    return "Invalid URL format.";
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return "Only http:// and https:// URLs are supported.";
  }

  return null;
}

// Paths the API serves itself; a short link with one of these codes could never be reached.
export const RESERVED_SHORT_CODES = new Set([
  "api",
  "api-docs",
  "health",
  "docs",
  "favicon.ico",
  "robots.txt",
]);

export function validateCustomShortCode(shortCode) {
  if (typeof shortCode !== "string") {
    return "shortCode must be a string.";
  }

  const trimmed = shortCode.trim();

  if (trimmed.length === 0) {
    return "shortCode cannot be empty or contain only whitespace.";
  }

  if (trimmed.length < 3 || trimmed.length > 20) {
    return "shortCode must be between 3 and 20 characters long.";
  }

  const allowedRegex = /^[a-zA-Z0-9_-]+$/;
  if (!allowedRegex.test(trimmed)) {
    return "shortCode can only contain letters, numbers, hyphens, and underscores.";
  }

  if (RESERVED_SHORT_CODES.has(trimmed.toLowerCase())) {
    return "This shortCode is reserved. Please choose another one.";
  }

  return null;
}
