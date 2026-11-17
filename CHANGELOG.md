# Changelog

## 17/11/2026

### Map and card migration

1. Replace `params.map.sites` and the `site-cards` shortcode. Store each map
   marker as a content page under a source section, then use
   `{{< map sections="locations" >}}` and
   `{{< map-cards sections="locations" >}}`. A marker needs latitude and
   longitude; its page title supplies the label (`campaign` in the old data),
   and explicit weights preserve the old marker order. For the default
   callout, move the old `description`, `content.image`, and `page` values to
   optional `callout.description`, `callout.image`, and `callout.link` fields.
   Other site-specific content can live in the marker page's front matter or
   body and be rendered by a custom layout.
2. Move map settings from `params.map` into a `map_options` map on the first
   listed source section, or into the content page named by the `map_params`
   shortcode argument. Flatten `initial_center.latitude` and
   `initial_center.longitude` to `initial_latitude` and `initial_longitude`;
   flatten the `bounds` values (`north`, `south`, `east`, and `west`) into
   `map_options`. Keep map setting names such as `min_zoom`, `max_zoom`,
   `initial_zoom`, `fit_initial_bounds`, and `strict_bounds`.
3. Move the former `preview-callout-only`, `onboarding-title`, and
   `onboarding-text` shortcode arguments to `preview_callout_only`,
   `onboarding_title`, and `onboarding_text` front matter. Onboarding is now
   disabled by default; set `show_onboarding: true` on the source section or in
   `map_params` to retain the former initial callout.
4. Replace the former `on-callout-shown` and `on-callout-hidden` shortcode
   callback arguments with listeners for `micro-map:callout-shown` and
   `micro-map:callout-hidden`. These bubbling events are dispatched from each
   map root and include `{ callout, location, index }` in `event.detail`.
5. Update custom CSS that targets renamed map or card markup: map classes now
   use the `.micro-map-*` prefix and map custom properties use `--micro-map-*`;
   the old `.site-cards`/`.cards-grid` markup is replaced by `.micro-map-cards`
   and `.micro-cards-*`. Rename `.oe-cards` to `.micro-cards-stretch`.
6. Migrate theme overrides of `map/callout.html` to
   `map/callout-content.html`. For custom map-card markup, pass its layout
   partial with the `layout` argument to `map-cards`. Update these partials to
   use the marker-page context instead of the former `.site` data object.
7. Provide `GOOGLE_MAPS_API_KEY` in the environment used for production Hugo
   builds. Interactive maps now fail the build if the key is missing or blank;
   callout-preview-only maps do not require it.


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
