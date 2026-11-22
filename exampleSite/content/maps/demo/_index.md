---
# Human-readable name for the example map section.
title: Map shortcode demo
weight: 42 # low priority just in case this gets copied it won't become default in the microsite

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

# Optional partial path for marker callout content. The default is
# map/callout-content.html and is also used by map-cards unless its layout
# argument supplies a custom card layout.
# callout_content: map/custom-callout-content.html

# Text shown in the map's initial onboarding callout.

show_onboarding: true
onboarding_title: Explore the example recording locations
onboarding_text: Choose a location on the map to find out more about the field site.

# Set true during dev to view the first callout without loading the interactive map or Google Maps API.
preview_callout_only: false

# Callout events bubble from the map root and include { callout, location, index } in detail.
# document.addEventListener("micro-map:callout-shown", ({ detail }) => {
#   const { callout, location, index } = detail;
# });
# document.addEventListener("micro-map:callout-hidden", ({ detail }) => {
#   const { callout, location, index } = detail;
# });

# Use a comma-separated path list to combine sources.
# {{< map sections="maps/demo" />}}
# {{< map sections="maps/north, maps/south" map_params="maps/config" />}}
# map_params optionally names another content page for map and card settings.
# By default, settings come from the first listed section.
---
