# microsite-template

A hugo theme used to build content heavy microsites which allow citizen participation in verification

## How to Contribute

To run the website locally, run:

```sh
hugo server -DEF --tlsAuto
```

The `--tlsAuto` flag serves the site over HTTPS (with automatically generated local certificates), which is required for Workbench authentication callbacks.

Once running, access the local website at <https://development.ecosounds.org:1313>.

## Preview the Map Example

The map demo lives in `exampleSite` so it is available when previewing the theme
without becoming content in microsites that use it. From the theme repository:

```sh
cd exampleSite
sh ./serve.sh
```

Set `GOOGLE_MAPS_API_KEY` in the environment to load the interactive Google Map.
Without a key, the map displays its local setup message.

## Deployment

Deployment instructions can be found in [DEPLOYMENT.md](./DEPLOYMENT.md)

When updating an existing microsite's theme, check the
[changelog and upgrade steps](./CHANGELOG.md) for changes needed in the child site
or its Workbench deployment.
