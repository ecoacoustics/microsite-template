---
# Human-readable name for this map section.
title: Map shortcode demo

# Google Maps settings. Omitted values use the defaults in assets/js/map.js.
map_options:
  # Initial map center, in decimal degrees.
  initial_latitude: -27.5
  initial_longitude: 137.5
  # Initial zoom and permitted zoom range.
  initial_zoom: 4
  min_zoom: 3
  max_zoom: 12
  # Whether Google Maps strictly enforces the geographic bounds below.
  strict_bounds: false
  # Geographic bounds used for map restriction and optional initial fitting.
  north: -10
  south: -45
  east: 155
  west: 110
  # Fit the map to the bounds after it loads instead of using the initial center/zoom.
  fit_initial_bounds: true

# Text shown in the map's initial onboarding callout.
onboarding_title: Explore the example recording locations
onboarding_text: Choose a location on the map to find out more about the field site.

# Set true during dev to style the first callout without loading the interactive map or Google Maps API.
preview_callout_only: false

# Optional JavaScript function names, called with the callout element, location, and index.
# Define the named functions on globalThis before enabling these.
# on_callout_shown: "handleMapCalloutShown"
# on_callout_hidden: "handleMapCalloutHidden"

# A shortcode's map_params JSON can override these settings for one map:
# {{< map section="maps/demo" map_params=`{"map_options":{"initial_zoom":6}}` >}}
---
