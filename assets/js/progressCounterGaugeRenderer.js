/**
 * Applies normalized completion to the default semicircular SVG gauge.
 *
 * @param {Element} root
 * @param {number} completionPercentage
 */
export function renderProgressCounterGauge(root, completionPercentage) {
    const angle = -90 + completionPercentage / 100 * 180;
    const progress = root.querySelector(".progress-counter-gauge-progress");
    const needle = root.querySelector(".progress-counter-needle");

    if (progress) {
        progress.style.strokeDashoffset = String(100 - completionPercentage);
    }
    if (needle) {
        needle.style.transform = `rotate(${angle}deg)`;
    }
}
