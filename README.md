# microsite-template

A hugo theme used to build content heavy microsites which allow citizen participation in verification

## How to Contribute

To run the website locally, run:

```sh
hugo server -DEF --tlsAuto
```

The `--tlsAuto` flag serves the site over HTTPS (with automatically generated local certificates), which is required for Workbench authentication callbacks.

Once running, access the local website at <https://development.ecosounds.org:1313>.

## Deployment

Deployment instructions can be found in [DEPLOYMENT.md](./DEPLOYMENT.md)

When updating an existing microsite's theme, check the
[changelog and upgrade steps](./CHANGELOG.md) for changes needed in the child site
or its Workbench deployment.

## Authentication Tests

Run the login and registration callback regression tests with Node.js 22:

```sh
node --experimental-vm-modules --test tests/auth.test.mjs
```

With Hugo available on PATH, also run the configuration build checks:

```sh
node --test tests/config.test.mjs
```

Set `HUGO_BINARY` to a Hugo executable path if it is not on PATH. These checks
verify required `params.workbench_name` values and the production guard against `Staging`.
