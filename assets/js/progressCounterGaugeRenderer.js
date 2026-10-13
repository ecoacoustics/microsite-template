/**
 * Applies normalized completion to the default semicircular SVG gauge.
 *
 * @param {Element} root
 * @param {number} completionPercentage
 */
export function renderProgressCounterGauge(root, completionPercentage) {
    // Map 0-100% completion to the gauge's -90 to 90 degree semicircle.
    const angle = -90 + completionPercentage / 100 * 180;
    const progress = root.querySelector(".progress-counter-gauge-progress");
    const needle = root.querySelector(".progress-counter-needle");

    if (progress) {
        progress.style.setProperty(
            "--progress-gauge-dash-offset",
            String(100 - completionPercentage),
        );
    }
    if (needle) {
        needle.style.setProperty(
            "--progress-gauge-needle-angle",
            `${angle}deg`,
        );
    }
}
