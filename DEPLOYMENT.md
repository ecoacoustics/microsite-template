# Deployment

To deploy a microsite, we will use the microsite template (this repository) as
a hugo theme.

## Creating a Microsite

Most of the steps described can be found in the hugo
[quick start guide](https://gohugo.io/getting-started/quick-start/).

1. Create a new repository under the open ecoacoustics GitHub organization
    - We typically use the `-microsite` suffix in the repository name.
      E.g. (`australasian-bittern-microsite`)
2. Clone the repository and run `hugo new site .`
3. Install [git lfs](https://git-lfs.com/) hooks into the repository by running `git lfs install`
4. Add the microsite template as a theme
    - `git submodule add https://github.com/ecoacoustics/microsite-template.git themes/microsite-template`
    - `echo "theme: "microsite-template" >> hugo.yaml`
5. Initialize the websites content from the microsite template
    - `cp -r ./themes/microsite-template/content/* ./content/`
    - `cp -r ./themes/microsite-template/layouts/shortcodes/* ./layouts/shortcodes/`
    - `cp ./themes/microsite-template/hugo.yaml ./hugo.yaml`
    - `cp ./themes/microsite-template/netlify.toml ./netlify.toml`

## Deploying a Microsite

1. Ensure that the new microsite repository is public
2. Publish to Netlify using the repository as the websites source
3. Create and publish a `call-detective.org` sub-domain
