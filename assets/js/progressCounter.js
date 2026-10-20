/*

Progress tracking elements are defined in a 2-level hierarchy in the dom, based on data attributes
The top level is a component, such as gauge, leaderboard, total, and must belong a specific list of supported types.

Each of these elements can have a campaign defined, which if ommitted with get stats for all campaigns

Each of these elements has a set of elements that will be populated with progress data fetched from the API. 

*/



import { combineFilters, createTagFilter } from "./filterHelpers.js";

const DEFAULT_LEADERBOARD_SIZE = 5;

/** @typedef {"gauge" | "leaderboard" | "total"} ProgressComponentType */

/** @typedef {"audioEventStats" | "verificationStats" | "userProfile" | "userAccounts"} ProgressDataFetch */

/**
 * @typedef {Object} ProgressComponentDefinition
 * @property {ProgressDataFetch[]} requiredDataFetches
 */

/**
 * @typedef {Object} ProgressGroup
 * @property {Campaign[]} campaigns
 * @property {Element[]} roots
 * @property {ProgressComponentType[]} progressComponentTypes
 * @property {number} [leaderboardSize] Selected size from the first leaderboard root in this group
 */

/** @type {Record<ProgressComponentType, ProgressComponentDefinition>} */
const PROGRESS_COMPONENT_DEFINITIONS = {
    gauge: {
        requiredDataFetches: ["audioEventStats", "verificationStats", "userProfile"],
    },
    leaderboard: {
        requiredDataFetches: ["verificationStats", "userProfile", "userAccounts"],
    },
    total: {
        requiredDataFetches: ["verificationStats"],
    },
};

/**
 * @typedef {Object} Campaign
 * @property {string} name
 * @property {number[]} [tag_ids]
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
 * @param {number} [leaderboardSize=DEFAULT_LEADERBOARD_SIZE]
 * @param {WorkbenchApi} api
 * @returns {Promise<LeaderboardEntry[]>}
 */
async function setupLeaderboard(
    leaderboardApiData,
    currentUserID,
    leaderboardSize = DEFAULT_LEADERBOARD_SIZE,
    api,
) {

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
 * @param {Campaign | Campaign[]} campaigns
 * @param {WorkbenchApi} api
 * @param {ProgressComponentType[]} [progressComponentTypes=["gauge", "leaderboard", "total"]]
 * @param {{leaderboardSize?: number}} [options]
 * @returns {Promise<ProgressCounterState>}
 */
export async function fetchProgressCounterData(
    campaigns,
    api,
    progressComponentTypes,
    options = {},
) {
    const selectedCampaigns = Array.isArray(campaigns) ? campaigns : [campaigns];
    const { leaderboardSize = DEFAULT_LEADERBOARD_SIZE } = options;
    const requiredDataFetches = new Set();

    if (progressComponentTypes.length === 0) {
        return { state: "unconfigured" };
    }

    for (const componentType of progressComponentTypes) {
        const componentDefinition = PROGRESS_COMPONENT_DEFINITIONS[componentType];
        if (!componentDefinition) {
            return { state: "unconfigured" };
        }

        for (const dataFetch of componentDefinition.requiredDataFetches) {
            requiredDataFetches.add(dataFetch);
        }
    }

    if (
        selectedCampaigns.length === 0 ||
        selectedCampaigns.some((campaign) => !campaign?.filters?.filter)
    ) {
        return { state: "unconfigured" };
    }

    const campaignNames = selectedCampaigns.map(({ name }) => name).join(", ");
    const audioEventFilter = combineFilters(selectedCampaigns.map((campaign) =>
        combineFilters([
            campaign.filters.filter,
            createTagFilter(campaign.tag_ids),
        ]),
    ), "or");

    const verificationFilter = combineFilters(selectedCampaigns.map((campaign) =>
        combineFilters([
            campaign.filters.filter,
            createTagFilter(campaign.tag_ids, "tag_id"),
        ]),
    ), "or");

    try {
        const [audioEventStats, verificationStats, userProfile] = await Promise.all([
            requiredDataFetches.has("audioEventStats") ? api.getAudioEventStats(audioEventFilter) : null,
            requiredDataFetches.has("verificationStats") ? api.getVerificationStats(verificationFilter) : null,
            requiredDataFetches.has("userProfile") ? api.getUserProfile() : null,
        ]);

        const leaderboardApiData = verificationStats?.verification_leaderboard ?? [];
        const currentUserID = userProfile?.data?.id ?? null;

        const leaderboard = requiredDataFetches.has("userAccounts")
            ? await setupLeaderboard(
                leaderboardApiData,
                currentUserID,
                leaderboardSize,
                api,
            )
            : [];

        const loggedIn = currentUserID !== null;

        const totalEvents = Number(audioEventStats?.count) || 0;
        const completedEvents = Number(verificationStats?.user_verified_events_count) || 0;
        const completionPercentage = loggedIn && totalEvents
            ? Math.min(100, completedEvents / totalEvents * 100)
            : 0;
        return {
            state: "ready",
            loggedIn,
            completedEvents,
            totalEvents,
            completionPercentage,
            totalCommunityVerifications: Number(verificationStats?.count) || 0,
            leaderboard,
        };
    } catch (error) {
        console.error(`Failed to load progress for ${campaignNames}.`, error);
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

    // looks through the page to find elements that have the data-progress-counter attribute
    // these contain elements of the progress counter such as the gauge, leaderboard, and total events.
    // which themeselves contain elements that display the progress data which get updated later
    const roots = [...document.querySelectorAll("[data-progress-counter]")];
    if (roots.length === 0) return;

    // each root has a configured campaign selection. Multiple roots can share the same campaign.
    const configuredCampaigns = Array.isArray(globalThis.siteParams?.campaigns)
        ? globalThis.siteParams.campaigns
        : [];

    // each "group" is a set of roots that share the same selected campaigns.
    // keys are the JSON stringified names of the selected campaigns.

    /** @type {Map<string, ProgressGroup>} */
    const groups = new Map();

    for (const root of roots) {
        const component = root.dataset.progressComponent;
        if (component !== "gauge" && component !== "leaderboard" && component !== "total") {
            render(root, { state: "unconfigured" });
            console.warn("Unknown progress component on root:", root);
            continue;
        }

        // An omitted campaign or * selects all configured campaigns.
        const selection = root.dataset.campaign;
        const selectedCampaigns = !selection || selection === "*"
            ? configuredCampaigns
            : configuredCampaigns.filter((campaign) => campaign.name === selection);

        // catch the case where no valid campaigns are specified for this root
        if (
            selectedCampaigns.length === 0 ||
            selectedCampaigns.some((campaign) => !campaign.filters?.filter)
        ) {
            render(root, { state: "unconfigured" });
            console.warn(`No valid campaigns specified for root:`, root);
            continue;
        }

        // create a key for this group of campaigns, which is a JSON string of the sorted campaign names
        // and initialise a new group empty if it doesn't already exist.
        const groupKey = JSON.stringify(selectedCampaigns.map(({ name }) => name).sort());
        let group = groups.get(groupKey);
        if (!group) {
            group = {
                campaigns: selectedCampaigns,
                roots: [],
                progressComponentTypes: [],
                leaderboardSize: undefined,
            };
            groups.set(groupKey, group);
        }

        group.roots.push(root);
        if (!group.progressComponentTypes.includes(component)) {
            group.progressComponentTypes.push(component);
        }
        if (component === "leaderboard" && group.leaderboardSize === undefined) {
            const requestedSize = Number(root.dataset.progressLeaderboardSize);
            group.leaderboardSize = Number.isInteger(requestedSize) && requestedSize > 0
                ? requestedSize
                : DEFAULT_LEADERBOARD_SIZE;
        }
    }

    if (groups.size === 0) return;

    try {
        const api = await workbenchApi();
        await Promise.all([...groups.values()].map(async (group) => {
            const state = await fetchProgressCounterData(
                group.campaigns,
                api,
                group.progressComponentTypes,
                { leaderboardSize: group.leaderboardSize },
            );
            group.roots.forEach((root) => render(root, state));
        }));
    } catch (error) {
        console.error("Failed to initialize progress counters.", error);
        for (const group of groups.values()) {
            group.roots.forEach((root) => render(root, {
            state: "error",
            }));
        }
    }
}
