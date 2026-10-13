import { combineFilters, createTagFilter } from "./filterHelpers.js";

/**
 * @typedef {Object} Campaign
 * @property {string} name
 * @property {number[]} [tag_ids]
 * @property {number} [leaderboard_size]
 * @property {boolean} [only_unverified]
 * @property {{filter: Record<string, unknown>}} filters
 */

/**
 * Represents a leaderboard item returned by the verification-stats API.
 *
 * The API appends a synthetic row when the requesting user is not ranked.
 * That row has a null rank. Its user_id is numeric for a logged-in user and
 * null for an anonymous requester.
 * @typedef {Object} LeaderboardResponseItem
 * @property {number | null} rank
 * @property {number | null} user_id
 * @property {number} verification_count
 */

/**
 * Represents a single entry in the leaderboard as used by the UI.
 * @typedef {Object} LeaderboardEntry
 * @property {number} rank
 * @property {number} user_id
 * @property {string | null} name
 * @property {number} verificationCount
 * @property {boolean} isCurrentUser
 */

/**
 * @typedef {Object} ProgressCounterUnconfiguredState
 * @property {"unconfigured"} state
 */

/**
 * @typedef {Object} ProgressCounterErrorState
 * @property {"error"} state
 */

/**
 * @typedef {Object} ProgressCounterReadyState
 * @property {"ready"} state
 * @property {boolean} loggedIn
 * @property {number} completedEvents
 * @property {number} totalEvents
 * @property {number} completionPercentage
 * @property {number} totalCommunityVerifications
 * @property {LeaderboardEntry[]} leaderboard
 */

/**
 * @typedef {ProgressCounterUnconfiguredState | ProgressCounterErrorState | ProgressCounterReadyState} ProgressCounterState
 */

/**
 * Keeps the top leaderboard rows, or the top rows plus the current user when
 * that user ranks below the configured limit.
 *
 * @param {LeaderboardResponseItem[]} leaderboard
 * @param {number | null} currentUserID
 * @param {number} [top=5]
 * @returns {LeaderboardResponseItem[]}
 */
function selectLeaderboardEntries(leaderboard, currentUserID, top = 5) {

    // Filter out entries without a rank and sort the remaining entries by rank.
    const orderedEntries = leaderboard
        .filter(({ rank }) => rank !== null)
        .sort(({ rank: firstRank }, { rank: secondRank }) => firstRank - secondRank);


    if (currentUserID === null) {
        return orderedEntries.slice(0, top);
    }

    // if there is a logged in user, find which item in the leaderboard is the current user
    // and ensure they are included in the leaderboard 
    const currentUserEntry = leaderboard.find(
        ({ user_id }) => user_id === currentUserID,
    );

    // if the current user is in the top N, return the top N
    if (
        !currentUserEntry ||
        currentUserEntry.rank === null ||
        currentUserEntry.rank <= top
    ) {
        return orderedEntries.slice(0, top);
    }
    // if they are not in the top N, include the top N minus one plus the current user
    return [...orderedEntries.slice(0, top - 1), currentUserEntry];
}

/**
 * Selects leaderboard rows, resolves contributor names, and maps the API
 * response items to entries used by the progress-counter UI.
 *
 * @param {LeaderboardResponseItem[]} leaderboardApiData
 * @param {number | null} currentUserID
 * @param {number} [leaderboardSize=5]
 * @param {WorkbenchApi} api
 * @returns {Promise<LeaderboardEntry[]>}
 */
async function setupLeaderboard(leaderboardApiData, currentUserID, leaderboardSize, api) {

        // filter only the top n items
        const leaderboard = selectLeaderboardEntries(
            leaderboardApiData,
            currentUserID,
            leaderboardSize,
        );

        const userIDs = leaderboard
            .map((entry) => entry.user_id);
        const users = await api.getUserAccounts(userIDs);
        const usersByID = new Map(users.map((user) => [user.id, user.user_name]));

        return leaderboard.map((entry, index) => ({
                rank: entry.rank ?? index + 1,
                user_id: entry.user_id,
                    name: usersByID.get(entry.user_id) ?? null,
                verificationCount: Number(entry.verification_count) || 0,
                    isCurrentUser: entry.user_id === currentUserID,
            }));
}

/**
 * Fetches and normalizes all data needed by a progress-counter renderer.
 *
 * This function deliberately has no DOM dependency. A different graphic can
 * consume the returned state without changing the API requests or calculations.
 *
 * @param {Campaign | undefined} campaign
 * @param {WorkbenchApi} api
 * @returns {Promise<ProgressCounterState>}
 */
export async function fetchProgressCounterData(campaign, api) {
    const campaignFilter = campaign?.filters?.filter;

    if (!campaign || !campaignFilter) {
        return {
            state: "unconfigured",
        };
    }

    const audioEventFilter = combineFilters([
        campaignFilter,
        createTagFilter(campaign.tag_ids),
    ]);

    const verificationFilter = combineFilters([
        campaignFilter,
        createTagFilter(campaign.tag_ids, "tag_id"),
    ]);

    try {
        const [audioEventStats, verificationStats, userProfile] = await Promise.all([
            api.getAudioEventStats(audioEventFilter),
            api.getVerificationStats(verificationFilter),
            api.getUserProfile(),
        ]);

        const leaderboardApiData = verificationStats.verification_leaderboard ?? [];
        const currentUserID = userProfile?.data?.id ?? null;

        // filter the top n items, sort them, and populate leaderboard entries with usernames
        const leaderboard = await setupLeaderboard(
            leaderboardApiData,
            currentUserID,
            campaign.leaderboard_size,
            api,
        );

        const loggedIn = currentUserID !== null;

        const totalEvents = Number(audioEventStats.count) || 0;
        const completedEvents = Number(verificationStats.user_verified_events_count) || 0;
        const completionPercentage = loggedIn && totalEvents
            ? Math.min(100, completedEvents / totalEvents * 100)
            : 0;
        return {
            state: "ready",
            loggedIn,
            completedEvents,
            totalEvents,
            completionPercentage,
            totalCommunityVerifications: Number(verificationStats.count) || 0,
            leaderboard,
        };
    } catch (error) {
        console.error(`Failed to load progress for ${campaign.name}.`, error);
        return {
            state: "error",
        };
    }
}





/**
 * Loads progress state for each counter and passes it to a renderer callback.
 *
 * This is the only DOM-aware part of the data module: it finds counter roots
 * and reads their campaign names, but it does not modify those roots.
 *
 * @param {(root: Element, state: Record<string, unknown>) => void} render
 * @returns {Promise<void>}
 */
export async function initializeProgressCounters(render) {
    const roots = [...document.querySelectorAll("[data-progress-counter]")];
    if (roots.length === 0) return;

    try {
        const api = await workbenchApi();
        const campaigns = globalThis.siteParams?.campaigns ?? [];
        await Promise.all(roots.map(async (root) => {
            const campaign = campaigns.find((item) => item.name === root.dataset.campaign);
            const state = await fetchProgressCounterData(campaign, api);
            render(root, state);
        }));
    } catch (error) {
        console.error("Failed to initialize progress counters.", error);
        roots.forEach((root) => render(root, {
            state: "error",
        }));
    }
}
