function clampCalloutOffset(preferred, available, size, gap) {
    return Math.min(Math.max(gap, preferred), Math.max(gap, available - size - gap));
}

/** Returns the callout's top-left corner relative to the browser viewport. */
export function placeCalloutNarrow(markerRect, calloutSize, viewport, gap) {
    const leftSpace = markerRect.left;
    const rightSpace = viewport.width - markerRect.right;
    const topSpace = markerRect.top;
    const bottomSpace = viewport.height - markerRect.bottom;
    const horizontalSpace = Math.max(leftSpace, rightSpace);
    const verticalSpace = Math.max(topSpace, bottomSpace);
    const fitsHorizontally = horizontalSpace >= calloutSize.width + gap;
    const fitsVertically = verticalSpace >= calloutSize.height + gap;

    // Use the only axis that fits, or prefer vertical when it has much more space.
    const placeVertically = fitsHorizontally === fitsVertically
        ? verticalSpace >= horizontalSpace * 1.8
        : fitsVertically;
    const placeLeft = leftSpace >= rightSpace;
    const placeAbove = topSpace >= bottomSpace;
    const preferredLeft = placeVertically
        ? markerRect.left + (markerRect.width - calloutSize.width) / 2
        : placeLeft
            ? markerRect.left - calloutSize.width - gap
            : markerRect.right + gap;
    const preferredTop = placeVertically
        ? placeAbove
            ? markerRect.top - calloutSize.height - gap
            : markerRect.bottom + gap
        : markerRect.top + (markerRect.height - calloutSize.height) / 2;

    return {
        left: clampCalloutOffset(preferredLeft, viewport.width, calloutSize.width, gap),
        top: clampCalloutOffset(preferredTop, viewport.height, calloutSize.height, gap)
    };
}

/** Uses shell-relative coordinates for both the marker and the result. */
export function placeCalloutWide(point, calloutSize, shellSize, gap) {
    const onRight = point.x < shellSize.width * 0.58;
    return {
        left: onRight ? Math.min(shellSize.width - calloutSize.width - gap, shellSize.width * 0.62) : gap,
        top: clampCalloutOffset(point.y - calloutSize.height / 2, shellSize.height, calloutSize.height, gap)
    };
}

/** Connects the marker's edge to the rendered callout, in shell-relative coordinates. */
export function leaderLineEndpoints(point, calloutRect) {
    const x2 = point.x < calloutRect.left ? calloutRect.left : calloutRect.right;
    const y2 = Math.min(calloutRect.bottom - 28, Math.max(calloutRect.top + 28, point.y));
    const directionX = x2 - point.x;
    const directionY = y2 - point.y;
    const distance = Math.hypot(directionX, directionY) || 1;
    return {
        x1: point.x + directionX / distance * point.radius,
        y1: point.y + directionY / distance * point.radius,
        x2,
        y2
    };
}
