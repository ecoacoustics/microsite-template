/**
 * Creates a tag filter when tags are configured.
 *
 * @param {number[]} tagIDs
 * @param {string} tagField The field in the filter to which the tags should be applied.
 * @returns {Record<string, unknown> | null}
 */
export function createTagFilter(tagIDs, tagField = "audio_events_tags.tag_id") {
  if (!Array.isArray(tagIDs) || tagIDs.length === 0) {
    return null;
  }

  return {
    [tagField]: {
      in: tagIDs,
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
  const definedFilters = filterParts.filter(Boolean);

  if (definedFilters.length <= 1) {
    return definedFilters[0] ?? {};
  }

  return {
    [operator]: definedFilters,
  };
}

/**
 * Strips the model prefix from any filter key qualified by the given model.
 * e.g., "audio_events.id" becomes "id" if model is "audio_events".
 * TODO: remove this hack after the backend supports self-referencing associations 
 *
 * @param {Record<string, unknown>} filter
 * @param {string} modelName The model prefix to remove from matching filter keys.
 * @returns {Record<string, unknown>}
 */
export function resolveSelfAssociations(filter, modelName) {
    const prefix = `${modelName}.`;

    function recurse(obj) {
        if (Array.isArray(obj)) {
            return obj.map(recurse);
        } else if (obj && typeof obj === "object" && obj.constructor === Object) {
            return Object.fromEntries(
                Object.entries(obj).map(([key, value]) => [
                    key.startsWith(prefix) ? key.slice(prefix.length) : key,
                    recurse(value),
                ])
            );
        }
        return obj;
    }

    return recurse(filter);
}