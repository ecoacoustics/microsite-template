import { leaderLineEndpoints, placeCalloutNarrow, placeCalloutWide } from "./map-geometry.mjs";

const DEFAULT_MAP_OPTIONS = {
    min_zoom: 4,
    max_zoom: 12,
    center: {
        lat: -27.5,
        lng: 137.5
    },
    zoom: 4,
    fit_markers: {
        enabled: false,
        padding_pixels: 50
    },
    restriction: {
        mode: "none",
        strict_bounds: false,
        latitude_padding_degrees: 10,
        longitude_padding_degrees: 10,
        lat_lng_bounds: null
    }
};

/**
 * Parses one rendered map's configuration and merges each known option group
 * separately so partial nested settings retain their defaults.
 * @param {HTMLElement} root Map root containing the JSON configuration.
 * @returns {Object} Parsed map configuration with complete map options.
 */
function readMapConfig(root) {
    const config = JSON.parse(root.dataset.mapConfig);
    const supplied = config.mapOptions ?? {};
    const defaultRestriction = DEFAULT_MAP_OPTIONS.restriction;
    const suppliedRestriction = supplied.restriction ?? {};
    return {
        ...config,
        mapOptions: {
            ...DEFAULT_MAP_OPTIONS,
            ...supplied,
            center: {
                ...DEFAULT_MAP_OPTIONS.center,
                ...(supplied.center ?? {})
            },
            fit_markers: {
                ...DEFAULT_MAP_OPTIONS.fit_markers,
                ...(supplied.fit_markers ?? {})
            },
            restriction: {
                ...defaultRestriction,
                ...suppliedRestriction,
                lat_lng_bounds: {
                    ...(defaultRestriction.lat_lng_bounds ?? {}),
                    ...(suppliedRestriction.lat_lng_bounds ?? {})
                }
            }
        }
    };
}

/**
 * Converts a longitude into Google's -180 through 180 degree range.
 * @param {number} longitude Longitude that may include marker padding.
 * @returns {number} Normalized longitude.
 */
function normalizeLongitude(longitude) {
    return ((longitude + 180) % 360 + 360) % 360 - 180;
}

/**
 * Load Google Maps once for the whole page.
 *
 * The Google script URL accepts the name of a global callback to call when the
 * API is ready. The browser reports download failures through script.onerror.
 * This Promise turns those two callback-style events into something init() can
 * await: resolve on Google's callback, reject on a download error.
 *
 * Every map root receives the same Promise. That prevents several maps from
 * adding duplicate script elements, and each waits until Google is ready before
 * it calls importLibrary() or creates markers.
 *
 * Loading the Google Maps API script on demand avoids downloading it on pages
 * without maps. The shared Promise also makes each map wait for the API rather
 * than depending on script order.
 * @param {string} apiKey Google Maps JavaScript API key.
 * @returns {Promise<void>} Resolves when Google Maps is ready, or rejects on load failure.
 */
function loadGoogleMaps(apiKey) {
    if (!apiKey) return Promise.reject(new Error("GOOGLE_MAPS_API_KEY is not configured."));
    if (globalThis.__micrositeGoogleMapsLoader) return globalThis.__micrositeGoogleMapsLoader;

    const loader = new Promise((resolve, reject) => {
        // Google calls this global function after the downloaded API is ready.
        const callbackName = `mapReady_${Date.now()}`;
        const script = document.createElement("script");
        const params = new URLSearchParams({ callback: callbackName, key: apiKey, libraries: "marker", v: "weekly" });
        globalThis[callbackName] = () => {
            delete globalThis[callbackName];
            resolve();
        };
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
        script.onerror = () => {
            delete globalThis[callbackName];
            // Remove a failed page-wide attempt so a later call can retry it.
            if (globalThis.__micrositeGoogleMapsLoader === loader) {
                delete globalThis.__micrositeGoogleMapsLoader;
            }
            reject(new Error("Google Maps JavaScript API failed to load."));
        };
        document.head.appendChild(script);
    });
    globalThis.__micrositeGoogleMapsLoader = loader;
    return loader;
}

class MicroMap {
    /**
     * Reads one map root's configuration and caches its page elements and state.
     * @param {HTMLElement} root Map root containing map configuration and callout markup.
     */
    constructor(root) {
        this.root = root;
        this.config = readMapConfig(root);
        this.mapShell = root.querySelector(".micro-map-shell");
        this.mapElement = root.querySelector(".micro-map-element");
        this.onboardingCallout = root.querySelector(".micro-map-onboarding-callout");
        this.callouts = [...root.querySelectorAll("sl-card.micro-map-callout")];
        this.leaderLine = root.querySelector(".micro-map-leader-line");
        this.locations = this.config.locations;
        this.googleMapsAPIKey = this.config.googleMapsAPIKey;
        this.googleMapsMapID = this.config.googleMapsMapID || "DEMO_MAP_ID";
        this.mapOptions = this.config.mapOptions;
        this.map = null;
        this.markers = [];
        this.selectedIndex = null;
        this.trackingFrame = null;
        this.narrowViewport = window.matchMedia(`(max-width: ${root.dataset.mapBreakpoint})`);
    }

    /** Returns the currently selected callout, or null when no marker is selected. */
    get selectedCallout() {
        return this.callouts[this.selectedIndex] ?? null;
    }

    /** Returns the currently selected marker button, or null when no marker is selected. */
    get selectedMarkerElement() {
        return this.markers[this.selectedIndex]?.content ?? null;
    }

    /**
     * Displays a loading or initialization error inside this map.
     * @param {string} message Plain-text error to display.
     */
    showMapMessage(message) {
        const messageElement = document.createElement("div");
        messageElement.className = "micro-map-message";
        messageElement.textContent = message;
        this.mapElement.replaceChildren(messageElement);
    }

    /** Positions the selected callout and draws its leader line. */
    layout() {
        const callout = this.selectedCallout;
        const markerElement = this.selectedMarkerElement;
        if (!callout || !markerElement || callout.hidden) {
            this.leaderLine.setAttribute("opacity", "0");
            return;
        }

        const shellRect = this.mapShell.getBoundingClientRect();
        const markerRect = markerElement.getBoundingClientRect();
        const point = {
            x: markerRect.left + markerRect.width / 2 - shellRect.left,
            y: markerRect.top + markerRect.height / 2 - shellRect.top,
            radius: Math.max(markerRect.width, markerRect.height) / 2
        };
        const calloutSize = { width: callout.offsetWidth, height: callout.offsetHeight };
        const gap = 24;
        let position;
        if (this.narrowViewport.matches) {
            const viewport = { width: window.innerWidth, height: window.innerHeight };
            const { left, top } = placeCalloutNarrow(markerRect, calloutSize, viewport, gap);
            position = { left: left - shellRect.left, top: top - shellRect.top };
        } else {
            const shellSize = { width: this.mapShell.clientWidth, height: this.mapShell.clientHeight };
            position = placeCalloutWide(point, calloutSize, shellSize, gap);
        }

        callout.style.bottom = "auto";
        callout.style.left = `${position.left}px`;
        callout.style.right = "auto";
        callout.style.top = `${position.top}px`;

        // Read the rendered box so the line meets the card, including the shell's border offset.
        const calloutRect = callout.getBoundingClientRect();
        const { x1, y1, x2, y2 } = leaderLineEndpoints(point, {
            left: calloutRect.left - shellRect.left,
            right: calloutRect.right - shellRect.left,
            top: calloutRect.top - shellRect.top,
            bottom: calloutRect.bottom - shellRect.top
        });
        this.leaderLine.setAttribute("x1", x1);
        this.leaderLine.setAttribute("y1", y1);
        this.leaderLine.setAttribute("x2", x2);
        this.leaderLine.setAttribute("y2", y2);
        this.leaderLine.setAttribute("opacity", "1");
    }

    /** Starts one animation-frame loop while the map's visible bounds are moving. */
    startTracking() {
        if (this.trackingFrame !== null) return;
        const track = () => {
            this.trackingFrame = null;
            if (!this.selectedCallout || this.selectedCallout.hidden) return;
            this.layout();
            this.trackingFrame = requestAnimationFrame(track);
        };
        this.trackingFrame = requestAnimationFrame(track);
    }

    /** Stops tracking and performs a final callout and leader-line layout. */
    stopTracking() {
        if (this.trackingFrame !== null) cancelAnimationFrame(this.trackingFrame);
        this.trackingFrame = null;
        this.layout();
    }

    /**
     * Marks one marker button as selected and clears the others.
     * @param {number|null} index Selected location index, or null to clear all.
     */
    setMarkerState(index) {
        this.markers.forEach((marker, markerIndex) => {
            const isSelected = markerIndex === index;
            marker.content.classList.toggle("is-selected", isSelected);
            marker.content.setAttribute("aria-pressed", String(isSelected));
        });
    }

    /**
     * Dispatches a callout lifecycle event from this map root.
     * @param {string} eventName Event name.
     * @param {HTMLElement} callout Visible or newly hidden callout.
     * @param {number} index Location index from the rendered map configuration.
     */
    notifyCallout(eventName, callout, index) {
        this.root.dispatchEvent(new CustomEvent(eventName, {
            bubbles: true,
            detail: { callout, location: this.locations[index], index }
        }));
    }

    /**
     * Selects a location and synchronizes the callout, marker state, events, and focus.
     * @param {number} index Location index from the rendered map configuration.
     */
    select(index) {
        const previousIndex = this.selectedIndex;
        const previousCallout = this.selectedCallout;
        if (this.onboardingCallout) this.onboardingCallout.hidden = true;
        if (previousCallout) {
            this.notifyCallout("micro-map:callout-hidden", previousCallout, previousIndex);
            previousCallout.hidden = true;
        }

        this.selectedIndex = index;
        const callout = this.selectedCallout;
        callout.hidden = false;
        this.callouts.forEach((otherCallout) => {
            if (otherCallout !== callout) otherCallout.hidden = true;
        });
        this.notifyCallout("micro-map:callout-shown", callout, index);
        this.setMarkerState(index);
        this.layout();
        requestAnimationFrame(() => {
            if (this.selectedCallout === callout) {
                callout.focus({ preventScroll: true });
            }
        });
    }

    /** Hides the selected callout, clears marker state, and restores focus. */
    clearSelection() {
        const previousIndex = this.selectedIndex;
        const callout = this.selectedCallout;
        const markerElement = this.selectedMarkerElement;
        if (previousIndex === null || !callout) return;

        this.selectedIndex = null;
        this.notifyCallout("micro-map:callout-hidden", callout, previousIndex);
        callout.hidden = true;
        this.setMarkerState(null);
        this.stopTracking();
        markerElement?.focus({ preventScroll: true });
    }

    /**
     * Builds Google Maps marker fitting bounds from the rendered locations.
     * @returns {google.maps.LatLngBounds} Bounds containing every marker.
     */
    markerBounds() {
        return this.locations.reduce((bounds, location) => {
            bounds.extend({ lat: location.latitude, lng: location.longitude });
            return bounds;
        }, new google.maps.LatLngBounds());
    }

    /**
     * Translates the theme's restriction config into Google MapOptions.restriction.
     * @returns {Object|null} Google Maps restriction object, or null when disabled.
     */
    mapRestriction() {
        const restriction = this.mapOptions.restriction;
        if (restriction.mode === "none") return null;

        let latLngBounds;
        if (restriction.mode === "explicit") {
            latLngBounds = restriction.lat_lng_bounds;
            if (!latLngBounds || !["north", "south", "east", "west"].every((edge) => edge in latLngBounds)) {
                throw new Error("Explicit map restriction requires north, south, east, and west.");
            }
            const googleBounds = new google.maps.LatLngBounds(
                { lat: latLngBounds.south, lng: latLngBounds.west },
                { lat: latLngBounds.north, lng: latLngBounds.east }
            );
            const markerOutsideBounds = this.locations.find((location) => (
                !googleBounds.contains({ lat: location.latitude, lng: location.longitude })
            ));
            if (markerOutsideBounds) {
                throw new Error(`Map marker "${markerOutsideBounds.label}" is outside the explicit restriction.`);
            }
        } else if (restriction.mode === "markers") {
            const markerBounds = this.markerBounds();
            const northEast = markerBounds.getNorthEast();
            const southWest = markerBounds.getSouthWest();
            latLngBounds = {
                north: Math.min(90, northEast.lat() + restriction.latitude_padding_degrees),
                south: Math.max(-90, southWest.lat() - restriction.latitude_padding_degrees),
                east: normalizeLongitude(northEast.lng() + restriction.longitude_padding_degrees),
                west: normalizeLongitude(southWest.lng() - restriction.longitude_padding_degrees)
            };
        } else {
            throw new Error(`Unknown map restriction mode "${restriction.mode}".`);
        }

        return {
            latLngBounds,
            strictBounds: restriction.strict_bounds
        };
    }

    /** Loads Google Maps, creates the map and marker buttons, and wires interactions. */
    async init() {
        // All MicroMap instances share and await the same Google script load.
        await loadGoogleMaps(this.googleMapsAPIKey);
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const restriction = this.mapRestriction();
        this.map = new google.maps.Map(this.mapElement, {
            center: this.mapOptions.center,
            fullscreenControl: false,
            gestureHandling: "cooperative",
            mapId: this.googleMapsMapID,
            mapTypeControl: false,
            mapTypeId: "satellite",
            streetViewControl: false,
            zoom: this.mapOptions.zoom,
            minZoom: this.mapOptions.min_zoom,
            maxZoom: this.mapOptions.max_zoom,
            ...(restriction ? { restriction } : {})
        });
        this.markers = this.locations.map((location, index) => {
            const markerButton = document.createElement("button");
            markerButton.className = "micro-map-marker-button";
            markerButton.type = "button";
            markerButton.setAttribute("aria-label", location.label);
            markerButton.setAttribute("aria-pressed", "false");
            markerButton.innerHTML = '<span class="micro-map-marker-dot"></span>';
            const marker = new AdvancedMarkerElement({
                content: markerButton,
                gmpClickable: true,
                map: this.map,
                position: { lat: location.latitude, lng: location.longitude },
                title: location.label
            });
            markerButton.addEventListener("click", () => this.select(index));
            return marker;
        });
        if (this.mapOptions.fit_markers.enabled) {
            const markerBounds = this.markerBounds();
            google.maps.event.addListenerOnce(this.map, "idle", () => {
                this.map.fitBounds(markerBounds, this.mapOptions.fit_markers.padding_pixels);
            });
        }
        this.map.addListener("bounds_changed", () => this.startTracking());
        this.map.addListener("idle", () => this.stopTracking());
        window.addEventListener("resize", () => this.layout());
        this.callouts.forEach((callout) => {
            callout.querySelector(".micro-map-callout-close").addEventListener("click", () => this.clearSelection());
        });
        this.root.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || !this.selectedCallout) return;
            event.preventDefault();
            this.clearSelection();
        });
    }
}

document.querySelectorAll(".micro-map[data-map-config]").forEach((root) => {
    const microMap = new MicroMap(root);
    microMap.init().catch((error) => {
        console.error(error);
        microMap.showMapMessage(microMap.googleMapsAPIKey
            ? "Google Maps could not be loaded. Check the API key, Maps JavaScript API, and Advanced Markers configuration."
            : "Add GOOGLE_MAPS_API_KEY to the local environment to display this map.");
    });
});
