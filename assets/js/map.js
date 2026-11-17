/**
 * Initializes one map root and scopes its state and helpers to that map.
 * @param {HTMLElement} root - The map element containing its config and markup.
 */
function initializeMapElement(root) {
    // Parsed settings and metadata serialized by the Hugo map renderer.
    const config = JSON.parse(root.dataset.mapConfig);
    // Shared positioning container for the map, callouts, and leader line.
    const mapShell = root.querySelector(".micro-map-shell");
    // Element into which Google Maps renders.
    const mapElement = root.querySelector(".micro-map-element");
    // Introductory callout shown before a location is selected.
    const onboardingCallout = root.querySelector(".micro-map-onboarding-callout");
    // Location callouts 
    const callouts = [...root.querySelectorAll("sl-card.micro-map-callout")];
    // SVG line connecting the selected marker to its callout.
    const leaderLine = root.querySelector(".micro-map-leader-line");
    // Location metadata used for marker creation and callback arguments.
    const locations = config.locations;
    // Credentials and environment flag used by the Maps API loader.
    const googleMapsAPIKey = config.googleMapsAPIKey;
    // Google Maps map ID, with a demo fallback.
    const googleMapsMapID = config.googleMapsMapID || "DEMO_MAP_ID";
    // Defaults merged with section map_options and shortcode map_params.
    const mapOptions = {
        min_zoom: 4,
        max_zoom: 12,
        strict_bounds: false,
        initial_latitude: -27.5,
        initial_longitude: 137.5,
        initial_zoom: 4,
        fit_initial_bounds: true,
        north: -10,
        south: -45,
        east: 155,
        west: 110,
        ...config.mapOptions
    };
    // Google Maps instance, assigned after the API loads.
    let map;
    // Selected location index, or null when no location is selected.
    let selectedIndex = null;
    // DOM button for the selected marker, used to restore focus on close.
    let selectedMarkerElement = null;
    // Currently visible location callout, or null.
    let activeCallout = null;
    // Pending animation frame used to track the leader line.
    let trackingFrame = null;
    // Whether the leader-line animation loop is active.
    let leaderLineTracking = false;
    // Responsive breakpoint used to choose callout positioning behavior.
    const narrowViewport = window.matchMedia(`(max-width: ${root.dataset.mapBreakpoint})`);

    /** Displays a map initialization or loading error inside this map. */
    function showMapMessage(message) {
        mapElement.innerHTML = `<div class="micro-map-message">${message}</div>`;
    }

    /** Loads the Google Maps API once and shares the pending promise across maps. */
    function loadGoogleMaps() {
        if (!googleMapsAPIKey) return Promise.reject(new Error("GOOGLE_MAPS_API_KEY is not configured."));
        if (globalThis.__micrositeGoogleMapsLoader) return globalThis.__micrositeGoogleMapsLoader;
        let loader;
        loader = new Promise((resolve, reject) => {
            const callbackName = `mapReady_${Date.now()}`;
            const script = document.createElement("script");
            const params = new URLSearchParams({ callback: callbackName, key: googleMapsAPIKey, libraries: "marker", v: "weekly" });
            globalThis[callbackName] = () => { delete globalThis[callbackName]; resolve(); };
            script.async = true;
            script.defer = true;
            script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
            script.onerror = () => {
                delete globalThis[callbackName];
                if (globalThis.__micrositeGoogleMapsLoader === loader) delete globalThis.__micrositeGoogleMapsLoader;
                reject(new Error("Google Maps JavaScript API failed to load."));
            };
            document.head.appendChild(script);
        });
        globalThis.__micrositeGoogleMapsLoader = loader;
        return loader;
    }

    /** Returns the selected marker's center and radius relative to the map shell. */
    function getMapPoint() {
        if (!selectedMarkerElement || selectedIndex === null) return null;
        const shellBounds = mapShell.getBoundingClientRect();
        const markerBounds = selectedMarkerElement.getBoundingClientRect();
        return { x: markerBounds.left + markerBounds.width / 2 - shellBounds.left, y: markerBounds.top + markerBounds.height / 2 - shellBounds.top, radius: Math.max(markerBounds.width, markerBounds.height) / 2 };
    }

    /** Positions the active callout beside its marker, accounting for viewport size. */
    function positionCallout() {
        const point = getMapPoint();
        if (!point || !activeCallout || activeCallout.hidden) return;
        const calloutWidth = activeCallout.offsetWidth;
        const calloutHeight = activeCallout.offsetHeight;
        const gap = 24;

        activeCallout.style.bottom = "auto";

        if (narrowViewport.matches) {
            const markerBounds = selectedMarkerElement.getBoundingClientRect();
            const shellBounds = mapShell.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const leftSpace = markerBounds.left;
            const rightSpace = viewportWidth - markerBounds.right;
            const topSpace = markerBounds.top;
            const bottomSpace = viewportHeight - markerBounds.bottom;
            const horizontalSpace = Math.max(leftSpace, rightSpace);
            const verticalSpace = Math.max(topSpace, bottomSpace);
            const leftFits = leftSpace >= calloutWidth + gap;
            const rightFits = rightSpace >= calloutWidth + gap;
            const topFits = topSpace >= calloutHeight + gap;
            const bottomFits = bottomSpace >= calloutHeight + gap;
            let placeVertically = verticalSpace >= horizontalSpace * 1.8;
            if (placeVertically && !topFits && !bottomFits && (leftFits || rightFits)) placeVertically = false;
            if (!placeVertically && !leftFits && !rightFits && (topFits || bottomFits)) placeVertically = true;
            const placeLeft = leftSpace >= rightSpace && (leftFits || !rightFits);
            const placeAbove = topSpace >= bottomSpace && (topFits || !bottomFits);
            const preferredLeft = placeVertically
                ? markerBounds.left + (markerBounds.width - calloutWidth) / 2
                : placeLeft
                    ? markerBounds.left - calloutWidth - gap
                    : markerBounds.right + gap;
            const preferredTop = placeVertically
                ? placeAbove
                    ? markerBounds.top - calloutHeight - gap
                    : markerBounds.bottom + gap
                : markerBounds.top + (markerBounds.height - calloutHeight) / 2;
            const viewportLeft = Math.min(
                Math.max(gap, preferredLeft),
                Math.max(gap, viewportWidth - calloutWidth - gap)
            );
            const viewportTop = Math.min(
                Math.max(gap, preferredTop),
                Math.max(gap, viewportHeight - calloutHeight - gap)
            );

            activeCallout.style.left = `${viewportLeft - shellBounds.left}px`;
            activeCallout.style.right = "auto";
            activeCallout.style.top = `${viewportTop - shellBounds.top}px`;
            return;
        }

        const width = mapShell.clientWidth;
        const height = mapShell.clientHeight;
        const onRight = point.x < width * 0.58;
        const horizontal = { left: onRight ? Math.min(width - calloutWidth - gap, width * 0.62) : gap, right: "auto" };
        const top = Math.min(Math.max(gap, point.y - calloutHeight / 2), Math.max(gap, height - calloutHeight - gap));
        activeCallout.style.left = `${horizontal.left}px`;
        activeCallout.style.right = horizontal.right;
        activeCallout.style.top = `${top}px`;
    }

    /** Repositions the active callout and draws its leader line to the marker. */
    function updateLeaderLine() {
        if (selectedIndex === null || !activeCallout || activeCallout.hidden) { leaderLine.setAttribute("opacity", "0"); return; }
        positionCallout();
        const point = getMapPoint();
        const shellBounds = mapShell.getBoundingClientRect();
        const calloutBounds = activeCallout.getBoundingClientRect();
        const left = calloutBounds.left - shellBounds.left;
        const right = calloutBounds.right - shellBounds.left;
        const top = calloutBounds.top - shellBounds.top;
        const bottom = calloutBounds.bottom - shellBounds.top;
        const targetX = point.x < left ? left : right;
        const targetY = Math.min(bottom - 28, Math.max(top + 28, point.y));
        const directionX = targetX - point.x;
        const directionY = targetY - point.y;
        const distance = Math.hypot(directionX, directionY) || 1;
        leaderLine.setAttribute("x1", point.x + directionX / distance * point.radius);
        leaderLine.setAttribute("y1", point.y + directionY / distance * point.radius);
        leaderLine.setAttribute("x2", targetX);
        leaderLine.setAttribute("y2", targetY);
        leaderLine.setAttribute("opacity", "1");
    }

    /** Starts an animation-frame loop to keep the leader line aligned while the map moves. */
    function startLeaderLineTracking() {
        if (leaderLineTracking) return;
        leaderLineTracking = true;
        const track = () => {
            if (!leaderLineTracking || selectedIndex === null || !activeCallout || activeCallout.hidden) {
                leaderLineTracking = false;
                trackingFrame = null;
                return;
            }
            updateLeaderLine();
            trackingFrame = requestAnimationFrame(track);
        };
        trackingFrame = requestAnimationFrame(track);
    }

    /** Stops leader-line tracking and performs a final position update. */
    function stopLeaderLineTracking() {
        leaderLineTracking = false;
        if (trackingFrame !== null) cancelAnimationFrame(trackingFrame);
        trackingFrame = null;
        updateLeaderLine();
    }

    /** Updates marker styling and pressed-state accessibility attributes. */
    function setMarkerState(markers, index) {
        markers.forEach((marker, markerIndex) => {
            const isSelected = markerIndex === index;
            marker.content.classList.toggle("is-selected", isSelected);
            marker.content.setAttribute("aria-pressed", String(isSelected));
        });
    }

    /** Shows the callout at the given location index and returns its element. */
    function showCallout(index) {
        callouts.forEach((callout, calloutIndex) => {
            callout.hidden = calloutIndex !== index;
        });
        return callouts[index];
    }

    /** Hides a callout if an element was provided. */
    function hideCallout(callout) {
        if (callout) callout.hidden = true;
    }

    function notifyCallout(eventName, callout, index) {
        const location = locations[index];
        root.dispatchEvent(new CustomEvent(eventName, {
            bubbles: true,
            detail: { callout, location, index }
        }));
    }

    /** Selects a location and synchronizes its callout, marker, events, and focus. */
    function selectLocation(index, markers) {
        const previousIndex = selectedIndex;
        selectedIndex = index;
        selectedMarkerElement = markers[index].content;
        if (onboardingCallout) onboardingCallout.hidden = true;
        if (activeCallout) {
            notifyCallout("micro-map:callout-hidden", activeCallout, previousIndex);
            hideCallout(activeCallout);
        }
        activeCallout = showCallout(index);
        notifyCallout("micro-map:callout-shown", activeCallout, index);
        setMarkerState(markers, index);
        updateLeaderLine();
        requestAnimationFrame(() => activeCallout.focus({ preventScroll: true }));
    }

    /** Loads Google Maps, creates the map and markers, and wires their interactions. */
    async function initializeMap() {
        await loadGoogleMaps();
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const mapBounds = new google.maps.LatLngBounds(
            { lat: mapOptions.south, lng: mapOptions.west },
            { lat: mapOptions.north, lng: mapOptions.east }
        );
        map = new google.maps.Map(mapElement, {
            center: { lat: mapOptions.initial_latitude, lng: mapOptions.initial_longitude },
            fullscreenControl: false,
            gestureHandling: "cooperative",
            mapId: googleMapsMapID,
            mapTypeControl: false,
            mapTypeId: "satellite",
            streetViewControl: false,
            zoom: mapOptions.initial_zoom,
            minZoom: mapOptions.min_zoom,
            maxZoom: mapOptions.max_zoom,
            restriction: {
                latLngBounds: {
                    north: mapOptions.north,
                    south: mapOptions.south,
                    east: mapOptions.east,
                    west: mapOptions.west
                },
                strictBounds: mapOptions.strict_bounds
            }
        });
        const markers = locations.map((location, index) => {
            const markerButton = document.createElement("button");
            markerButton.className = "micro-map-marker-button";
            markerButton.type = "button";
            markerButton.setAttribute("aria-label", location.label);
            markerButton.setAttribute("aria-pressed", "false");
            markerButton.innerHTML = '<span class="micro-map-marker-dot"></span>';
            const marker = new AdvancedMarkerElement({ content: markerButton, gmpClickable: true, map, position: { lat: location.latitude, lng: location.longitude }, title: location.label });
            markerButton.addEventListener("click", () => selectLocation(index, markers));
            return marker;
        });
        if (mapOptions.fit_initial_bounds) google.maps.event.addListenerOnce(map, "idle", () => map.fitBounds(mapBounds, 0));
        map.addListener("bounds_changed", startLeaderLineTracking);
        map.addListener("idle", stopLeaderLineTracking);
        window.addEventListener("resize", updateLeaderLine);
        callouts.forEach((callout, index) => callout.querySelector(".micro-map-callout-close").addEventListener("click", () => {
            const markerToRestore = selectedMarkerElement;
            selectedIndex = null;
            selectedMarkerElement = null;
            notifyCallout("micro-map:callout-hidden", callout, index);
            hideCallout(callout);
            activeCallout = null;
            setMarkerState(markers, null);
            stopLeaderLineTracking();
            markerToRestore?.focus({ preventScroll: true });
        }));
        root.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || !activeCallout) return;
            event.preventDefault();
            activeCallout.querySelector(".micro-map-callout-close")?.click();
        });
    }

    initializeMap().catch((error) => {
        console.error(error);
        showMapMessage(googleMapsAPIKey ? "Google Maps could not be loaded. Check the API key, Maps JavaScript API, and Advanced Markers configuration." : "Add GOOGLE_MAPS_API_KEY to the local environment to display this map.");
    });
}

document.querySelectorAll(".micro-map[data-map-config]").forEach(initializeMapElement);
