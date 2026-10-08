import { combineFilters, createTagFilter } from "./filterHelpers.js";

/**
 * Keeps the API's top five rows, or the top four plus the current user when
 * that user ranks below fifth or has no rank yet.
 *
 * @param {Array<Record<string, unknown>>} leaderboard
 * @param {number | null} currentUserID
 * @returns {Array<Record<string, unknown>>}
 */
function selectLeaderboardEntries(leaderboard, currentUserID) {
    const topFive = leaderboard.filter(
        (entry) => entry.rank !== null && entry.rank <= 5,
    );
    const currentUserEntry = leaderboard.find((entry) => (
        currentUserID === null
            ? entry.user_id === null
            : entry.user_id === currentUserID
    ));

    if (!currentUserEntry || (currentUserEntry.rank !== null && currentUserEntry.rank <= 5)) {
        return topFive;
    }

    return [...topFive.slice(0, 4), currentUserEntry];
}

/**
 * Fetches and normalizes all data needed by a progress-counter renderer.
 *
 * This function deliberately has no DOM dependency. A different graphic can
 * consume the returned state without changing the API requests or calculations.
 *
 * @param {Record<string, unknown> | undefined} campaign
 * @param {WorkbenchApi} api
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchProgressCounterData(campaign, api) {
    const campaignFilter = campaign?.filters?.filter;

    if (!campaign || !campaignFilter) {
        return {
            state: "unconfigured",
            message: "Progress data is not configured for this site.",
        };
    }

    const audioEventFilter = combineFilters([
        campaignFilter,
        createTagFilter(campaign.tags),
    ]);
    const verificationFilter = combineFilters([
        campaignFilter,
        createTagFilter(campaign.tags, "tag_id"),
    ]);

    try {
        const [audioEventStats, verificationStats, userProfile] = await Promise.all([
            api.getAudioEventStats(audioEventFilter),
            api.getVerificationStats(verificationFilter),
            api.getUserProfile().catch(() => null),
        ]);

        const leaderboard = verificationStats.verification_leaderboard ?? [];
        const currentUserID = userProfile?.data?.id ?? null;
        const displayedLeaderboard = selectLeaderboardEntries(leaderboard, currentUserID);
        const userIDs = leaderboard
            .map((entry) => entry.user_id)
            .filter((userID) => userID !== null);
        const users = await api.getUserAccounts(userIDs);
        const usersByID = new Map(users.map((user) => [user.id, user.user_name]));
        const loggedIn = currentUserID !== null;
        const totalEvents = Number(audioEventStats.count) || 0;
        const completedEvents = Math.max(
            0,
            Number(verificationStats.user_verified_events_count) || 0,
        );
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
            leaderboard: displayedLeaderboard.map((entry, index) => ({
                rank: entry.rank ?? index + 1,
                name: entry.user_id === null
                    ? "Anonymous contributor"
                    : usersByID.get(entry.user_id) ?? `Contributor #${entry.user_id}`,
                verificationCount: Number(entry.verification_count) || 0,
                isCurrent: entry.user_id !== null && entry.user_id === currentUserID,
            })),
        };
    } catch (error) {
        console.error(`Failed to load progress for ${campaign.name}.`, error);
        return {
            state: "error",
            message: "Progress data is currently unavailable.",
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
            message: "Progress data is currently unavailable.",
        }));
    }
}
