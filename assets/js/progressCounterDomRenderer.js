/**
 * Updates a counter's status message and visibility.
 *
 * @param {Element} root
 * @param {string} message
 */
function setStatus(root, message) {
    const status = root.querySelector("[data-progress-status]");
    if (!status) return;

    status.textContent = message;
    status.hidden = !message;
}

/**
 * Shows or hides a progress-counter element.
 *
 * @param {Element} root
 * @param {string} selector
 * @param {boolean} hidden
 */
function setHidden(root, selector, hidden) {
    const element = root.querySelector(selector);
    if (element) element.hidden = hidden;
}

/**
 * Updates a text element when that component exists in the selected layout.
 *
 * @param {Element} root
 * @param {string} selector
 * @param {string} message
 */
function setText(root, selector, message) {
    const element = root.querySelector(selector);
    if (element) element.textContent = message;
}

/**
 * Renders normalized leaderboard data into the default table component.
 *
 * @param {Element} root
 * @param {Array<Record<string, unknown>>} leaderboard
 */
function renderLeaderboard(root, leaderboard) {
    const target = root.querySelector("[data-progress-leaderboard]");
    if (!target) return;

    const anonymousUserLabel = target.dataset.anonymousUserLabel;
    target.replaceChildren(
        ...leaderboard.map((entry) => {
            const row = document.createElement("tr");
            row.dataset.rank = String(entry.rank);
            if (entry.isCurrentUser) row.classList.add("is-current");

            [
                String(entry.rank),
                String(entry.name ?? anonymousUserLabel ?? ""),
                (Number(entry.verificationCount) || 0).toLocaleString(),
            ].forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });
            return row;
        }),
    );
}

/**
 * Renders shared progress state and delegates graphic-specific work.
 *
 * @param {Element} root
 * @param {Record<string, unknown>} state
 * @param {(root: Element, completionPercentage: number) => void} [renderGraphic]
 */
export function renderProgressCounter(root, state, renderGraphic) {
    if (state.state !== "ready") {
        setHidden(root, "[data-progress-fraction]", true);
        setHidden(root, "[data-progress-login-message]", true);
        setHidden(root, "[data-progress-unconfigured]", state.state !== "unconfigured");
        setHidden(root, "[data-progress-error]", state.state !== "error");
        setStatus(root, "");
        return;
    }

    const loggedIn = Boolean(state.loggedIn);
    const completionPercentage = Number(state.completionPercentage) || 0;

    setHidden(root, "[data-progress-fraction]", !loggedIn);
    setHidden(root, "[data-progress-login-message]", loggedIn);
    setHidden(root, "[data-progress-unconfigured]", true);
    setHidden(root, "[data-progress-error]", true);
    setText(root, "[data-progress-completed-events]", String(state.completedEvents));
    setText(root, "[data-progress-total-events]", String(state.totalEvents));
    setText(
        root,
        "[data-progress-total]",
        Number(state.totalCommunityVerifications).toLocaleString(),
    );
    setStatus(root, "");
    renderLeaderboard(root, state.leaderboard ?? []);
    renderGraphic?.(root, completionPercentage);
}
