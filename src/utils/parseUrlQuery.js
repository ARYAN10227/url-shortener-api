export function parseUrlQuery(query) {
  const { page, limit, search, sortBy, order, minClicks } = query || {};

  // 1. Pagination Validation
  let parsedPage = 1;
  let parsedLimit = 10;

  if (page !== undefined && page !== null && page !== "") {
    const num = Number(page);
    if (!Number.isInteger(num) || num < 1) {
      return { error: "page must be a positive integer greater than or equal to 1." };
    }
    parsedPage = num;
  }

  if (limit !== undefined && limit !== null && limit !== "") {
    const num = Number(limit);
    if (!Number.isInteger(num) || num < 1) {
      return { error: "limit must be a positive integer greater than or equal to 1." };
    }
    if (num > 100) {
      return { error: "limit cannot exceed 100." };
    }
    parsedLimit = num;
  }

  // 2. Sorting Validation
  const allowedSortBy = ["createdAt", "clicks", "originalUrl"];
  const parsedSortBy = sortBy || "createdAt";
  if (!allowedSortBy.includes(parsedSortBy)) {
    return { error: `sortBy must be one of: ${allowedSortBy.join(", ")}.` };
  }

  const allowedOrder = ["asc", "desc"];
  const parsedOrder = order || "desc";
  if (!allowedOrder.includes(parsedOrder)) {
    return { error: "order must be either 'asc' or 'desc'." };
  }

  // 3. Filtering Validation (minClicks)
  let parsedMinClicks = null;
  if (minClicks !== undefined && minClicks !== null && minClicks !== "") {
    const num = Number(minClicks);
    if (!Number.isInteger(num) || num < 0) {
      return { error: "minClicks must be a non-negative integer." };
    }
    parsedMinClicks = num;
  }

  // 4. Search term
  const parsedSearch = typeof search === "string" && search.trim() !== "" ? search.trim() : null;

  return {
    page: parsedPage,
    limit: parsedLimit,
    sortBy: parsedSortBy,
    order: parsedOrder,
    minClicks: parsedMinClicks,
    search: parsedSearch,
    error: null,
  };
}
