export function parseAnalyticsQuery(query) {
  const { from, to, limit } = query || {};

  // 1. Limit validation (default 20, min 1, max 100)
  let parsedLimit = 20;
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

  // 2. From date validation
  let fromDate = null;
  if (from !== undefined && from !== null && from !== "") {
    const date = new Date(from);
    if (isNaN(date.getTime())) {
      return { error: "from must be a valid ISO date string." };
    }
    fromDate = date;
  }

  // 3. To date validation
  let toDate = null;
  if (to !== undefined && to !== null && to !== "") {
    const date = new Date(to);
    if (isNaN(date.getTime())) {
      return { error: "to must be a valid ISO date string." };
    }
    toDate = date;
  }

  // 4. Date comparison check
  if (fromDate && toDate && fromDate > toDate) {
    return { error: "from date cannot be later than to date." };
  }

  return {
    limit: parsedLimit,
    fromDate,
    toDate,
    error: null,
  };
}
