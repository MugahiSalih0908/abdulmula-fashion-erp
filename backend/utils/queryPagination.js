function getPaginationOptions(query = {}, defaultLimit = 25, maxLimit = 100) {
  const paginationRequested = Object.prototype.hasOwnProperty.call(query, 'page')
    || Object.prototype.hasOwnProperty.call(query, 'limit');

  if (!paginationRequested) return null;

  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
  const limit = Math.min(requestedLimit, maxLimit);

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
}

module.exports = { getPaginationOptions, escapeRegExp };
