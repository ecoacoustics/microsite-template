/**
 * Creates a tag filter when tags are configured.
 *
 * @param {unknown} tags
 * @param {string} tagField The field in the filter to which the tags should be applied.
 * @returns {Record<string, unknown> | null}
 */
export function createTagFilter(tags, tagField = "tags.id") {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null;
  }

  return {
    [tagField]: {
      in: tags,
    },
  };
}

/**
 * Combines configured filter parts without mutating any of them.
 *
 * Null and undefined parts are ignored so optional filters preserve the
 * original base-filter behavior when they are not configured.
 *
 * @param {(Record<string, unknown> | null | undefined)[]} filterParts
 * @param {"and" | "or"} [operator="and"]
 * @returns {Record<string, unknown>}
 */
export function combineFilters(filterParts, operator = "and") {
  const definedFilters = filterParts.filter(
    (filter) => filter !== null && filter !== undefined,
  );

  if (definedFilters.length <= 1) {
    return definedFilters[0] ?? {};
  }

  return {
    [operator]: definedFilters,
  };
}
