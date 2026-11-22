# Changelog

## 17/11/2026

### Maps and location cards

1. Replace `params.map.sites` with one Markdown file per marker, for example
   `content/maps/locations/bowra.md`. Use `title` for the old `campaign` label,
   keep `latitude` and `longitude`, and set `weight` to control the order.
   For default callouts, move `description`, `content.image`, and `page` to
   `callout.description`, `callout.image`, and `callout.link`.
2. Use `{{< map sections="maps/locations" >}}` and replace `site-cards` with
   `{{< map-cards sections="maps/locations" >}}`. Put `map_options` in the
   source folder's own `_index.md`. Rename `initial_center.latitude` and
   `initial_center.longitude` to `initial_latitude` and `initial_longitude`,
   and move the four `bounds` keys directly under `map_options`.
3. Set `GOOGLE_MAPS_API_KEY` for production builds with interactive maps.
   A missing key now fails the build. See [deployment](./DEPLOYMENT.md#google-maps).

If you customized the old map or cards:

- Move preview and onboarding options to front matter. Set `show_onboarding: true`
  to keep the opening callout. Replace shortcode callbacks with listeners for
  `micro-map:callout-shown` and `micro-map:callout-hidden`.
- Move `map/callout.html` overrides to `map/callout-content.html`; use the
  `layout` argument for custom card markup. Both receive `.markerPage` instead
  of `.site`.
- Update custom CSS to target `.micro-map-*`, `--micro-map-*`, and
  `.micro-cards-*`. The default `.oe-cards` grid is now `.micro-cards-stretch`.

See the [map example](./exampleSite/content/maps/demo/_index.md) for configuration
and event examples.

## 13/10/2026 - Workbench login and registration callbacks

### Upgrade steps for existing microsites

1. Update the `microsite-template` theme submodule to a revision containing this
   change, and commit the updated submodule reference in the child site's repository.
2. Set the account provider's display name in the child site's `hugo.yaml`:

   ```yaml
   params:
     workbench_name: Staging
   ```

   Use the name of the actual Workbench for production sites, not `Staging`.
   Ensure `params.workbench_host` and `params.api_host` refer to the same environment.
   Setting the name explicitly is required for production.
3. Deploy Workbench with authentication callback support from
   [QutEcoacoustics/workbench-client commit db0c2e1](https://github.com/QutEcoacoustics/workbench-client/commit/db0c2e1bd70a835baf940f24b7a3b2486325238f)
   or later. Configure Workbench's `settings.authRedirectDomains` with each trusted
   microsite hostname. Include approved development and preview hostnames if they
   need registration support. Entries are domain names, not URLs; callbacks must
   use HTTPS. This setting is on Workbench, not in the child site's Hugo config.
4. Review any child overrides of `layouts/_default/login.html`,
   `layouts/partials/head.html`, or `assets/js/workbenchApi.js`. Overrides take
   precedence over the theme: merge the configurable provider name, registration
   callback link, early token removal, and token validation changes into them as
   applicable.
5. Build and deploy the child site, then verify:
   - The login page displays the correct account provider name.
   - Starting at `/login?redirect=%2Fverify`, registration returns directly to
     `/verify` authenticated.
   - `user_token` disappears from the browser URL, and the session survives reload.
   - An invalid token displays an error without redirecting or retaining a session.
   - Existing password login and logout still work.

The theme's authentication behavior is inherited unless overridden; no child content
migration is required. See
[Workbench registration deployment details](./DEPLOYMENT.md#workbench-registration).

## 05/11/2025 (PR: #103)

### Remove `{{< call-to-action >}}` shortcode

To migrate, you should now use the `{{< section class="oe-call-to-action" >}}` shortcode with a `oe-call-to-action` `class` attribute.
