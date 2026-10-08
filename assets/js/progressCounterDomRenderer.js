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
 * Updates the counter's primary progress message.
 *
 * @param {Element} root
 * @param {string} message
 */
function setFraction(root, message) {
    const fraction = root.querySelector("[data-progress-fraction]");
    if (fraction) fraction.textContent = message;
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

    target.replaceChildren();
    leaderboard.forEach((entry) => {
        const row = document.createElement("tr");
        row.dataset.rank = String(entry.rank);
        if (entry.isCurrent) row.classList.add("is-current");

        [String(entry.rank), String(entry.name ?? "")].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        target.appendChild(row);
    });
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
        setFraction(root, "Progress unavailable.");
        setStatus(root, String(state.message ?? "Progress data is unavailable."));
        return;
    }

    const loggedIn = Boolean(state.loggedIn);
    const completionPercentage = Number(state.completionPercentage) || 0;

    setFraction(root, loggedIn
        ? `${state.completedEvents} out of ${state.totalEvents} events verified.`
        : "Log in to see your contribution progress.");
    setText(
        root,
        "[data-progress-total]",
        Number(state.totalCommunityVerifications).toLocaleString(),
    );
    setStatus(root, "");
    renderLeaderboard(root, state.leaderboard ?? []);
    renderGraphic?.(root, completionPercentage);
}
