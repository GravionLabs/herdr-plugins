import { defineConfig } from 'vitepress';

const base = process.env['SITE_BASE'] ?? '/';
const REPO_URL = 'https://github.com/GravionLabs/herdr-plugins';

export default defineConfig({
  title: 'herdr plugins',
  description: 'Plugins for herdr and the GravionLabs agent workflow.',
  lang: 'en',
  // `/<repository>/` on GitHub Pages; the workflow sets SITE_BASE.
  base,
  // The site is the documentation of the repository: its pages are the files of `docs`.
  srcDir: '../../docs',
  // Architecture decision records stay in the repository; they are not part of the site.
  // The plugin page template is copied per plugin, never built as a page.
  srcExclude: ['adr/**', 'guide/plugins/_template.md'],
  // `docs/guide/README.md` is what GitHub shows for the folder, and the home of the guide here.
  rewrites: { 'guide/README.md': 'guide/index.md' },
  cleanUrls: true,
  lastUpdated: false,
  // A link that leads nowhere fails the build (no ignoreDeadLinks).
  themeConfig: {
    nav: [
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'Plugins', link: '/plugins/' },
      { text: 'Guides', link: '/guide/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'GitHub', link: REPO_URL },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guides',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Getting started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Plugin pages',
          items: [
            { text: 'link-trim', link: '/guide/plugins/link-trim' },
            { text: 'agent-notify', link: '/guide/plugins/agent-notify' },
            { text: 'deliver-board', link: '/guide/plugins/deliver-board' },
            { text: 'deliver-starter', link: '/guide/plugins/deliver-starter' },
            { text: 'deliver-view', link: '/guide/plugins/deliver-view' },
            { text: 'deliver-log', link: '/guide/plugins/deliver-log' },
            { text: 'review-popup', link: '/guide/plugins/review-popup' },
            { text: 'worktree-cleanup', link: '/guide/plugins/worktree-cleanup' },
            { text: 'command-palette', link: '/guide/plugins/command-palette' },
            { text: 'layout-bootstrap', link: '/guide/plugins/layout-bootstrap' },
          ],
        },
      ],
      '/plugins/': [{ text: 'Plugins', items: [{ text: 'Overview', link: '/plugins/' }] }],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Overview', link: '/reference/' },
            { text: 'Public names', link: '/naming' },
            { text: 'Compatibility', link: '/compatibility' },
            { text: 'Security review', link: '/security-review' },
            { text: 'Manual acceptance', link: '/acceptance' },
            { text: 'Publishing the site', link: '/reference/publishing-the-site' },
          ],
        },
      ],
    },
    search: { provider: 'local' },
    editLink: { pattern: `${REPO_URL}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
    socialLinks: [{ icon: 'github', link: REPO_URL }],
    footer: { message: 'Released under the MIT licence.' },
  },
});
