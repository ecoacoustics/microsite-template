# Changelog

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
