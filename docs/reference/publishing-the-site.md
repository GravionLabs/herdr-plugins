# Publishing the site

The documentation site (`apps/site`, built with VitePress from the files of `docs/`) is published to GitHub Pages by `.github/workflows/pages.yml`.

- **Pull requests** that touch `apps/site`, `docs` or the workflow build the site. A dead link fails the build, so it is found before the merge. Nothing is deployed.
- **Pushes to `main`** build the site again and deploy it, but only while the repository variable `DEPLOY_PAGES` is `true`. While it is unset or any other value, the workflow does nothing on a push.

The site is served at `https://gravionlabs.github.io/herdr-plugins/`. The workflow builds it with `SITE_BASE=/herdr-plugins/`.

## One-time setup (repository owner)

These steps change repository settings and are done by an owner in the GitHub web interface. The workflow does not do them.

1. **Pages source.** Open *Settings → Pages*. Under *Build and deployment → Source*, choose **GitHub Actions**.
2. **Repository homepage.** Open the repository front page, click the settings gear next to *About*, and set **Website** to `https://gravionlabs.github.io/herdr-plugins/`.
3. **Enable the deployment.** Open *Settings → Secrets and variables → Actions → Variables*, and add the repository variable `DEPLOY_PAGES` with the value `true`.

Until step 3 is done, pushes to `main` build nothing and deploy nothing.

## Turning it off

Set `DEPLOY_PAGES` to any value other than `true`, or delete it. Pull requests keep building the site.
