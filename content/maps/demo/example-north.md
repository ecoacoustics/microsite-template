---
# Page title/link title used as this marker's label.
title: Example Northern Recording Site
# Controls the marker and card order within the section.
weight: 1
# Required marker position, in decimal degrees.
latitude: -16.103236
longitude: 145.452491
build:
  # Keep the marker in local section listings, but out of site-wide listings.
  list: local
  # Do not generate a standalone HTML page for this marker.
  render: link
# Fields used by the shared default callout and card content.
callout:
  # Required shared title.
  heading: Example Northern Recording Site
  # Required image resource path, relative to the assets directory.
  image: images/Plains-wanderer.jpg
  # Optional accessible text for the image.
  image_alt: A plains-wanderer in grass
  # Required shared location description.
  description: An example map marker with a callout defined directly in its page front matter.
  # Required shared learn-more link target.
  link: /
---
