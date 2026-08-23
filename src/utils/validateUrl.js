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

  return null;
}
