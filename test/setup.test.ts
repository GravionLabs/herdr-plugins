import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, root), 'utf8');

describe('repository setup', () => {
  it('pins the runtime to Node 26 in package.json and .nvmrc', () => {
    expect(JSON.parse(read('package.json')).engines.node).toBe('>=26');
    expect(read('.nvmrc').trim()).toBe('26');
  });

  it('declares the MIT license in package.json and LICENSE', () => {
    expect(JSON.parse(read('package.json')).license).toBe('MIT');
    expect(read('LICENSE')).toMatch(/^MIT License\r?\n\r?\nCopyright \(c\) 2026 GravionLabs/);
  });

  it('ships SECURITY.md, CONTRIBUTING.md and CODE_OF_CONDUCT.md without an e-mail address in SECURITY.md', () => {
    for (const name of ['SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md']) {
      expect(existsSync(new URL(name, root)), `${name} is missing`).toBe(true);
    }
    expect(read('SECURITY.md')).not.toMatch(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i);
  });

  it('sets coverage thresholds in vitest.config.ts', () => {
    const config = read('vitest.config.ts');

    expect(config).toMatch(/provider:\s*'v8'/);
    expect(config).toMatch(/thresholds:\s*\{[^}]*statements:\s*[1-9]\d*[^}]*branches:\s*[1-9]\d*[^}]*functions:\s*[1-9]\d*[^}]*lines:\s*[1-9]\d*/);
  });

  it('lists @vitest/coverage-v8 as a devDependency', () => {
    expect(JSON.parse(read('package.json')).devDependencies).toHaveProperty('@vitest/coverage-v8');
  });

  it('has a section in docs/acceptance.md for every plugin directory', () => {
    const plugins = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/herdr-plugin.toml`, root)))
      .map((entry) => entry.name);
    const headings = read('docs/acceptance.md')
      .split('\n')
      .filter((line) => line.startsWith('## '))
      .map((line) => line.slice(3).replaceAll('`', '').trim());

    expect(plugins.length).toBeGreaterThan(0);
    for (const plugin of plugins) {
      expect(headings, `docs/acceptance.md has no "## \`${plugin}\`" section`).toContain(plugin);
    }
  });

  it('names ui.toast.delivery in the README of every plugin that calls notify', () => {
    // Plugins that show a notification and whose README must say that ui.toast.delivery may not be off.
    const listed = ['agent-notify', 'command-palette', 'deliver-log', 'deliver-starter', 'layout-bootstrap', 'link-trim', 'repo-open', 'review-popup', 'worktree-cleanup'];
    const pluginDirs = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/herdr-plugin.toml`, root)))
      .map((entry) => entry.name);
    const callers = pluginDirs.filter((plugin) =>
      ['bin', 'lib'].some((dir) =>
        existsSync(new URL(`${plugin}/${dir}/`, root)) &&
        readdirSync(new URL(`${plugin}/${dir}/`, root))
          .filter((file) => file.endsWith('.ts'))
          .some((file) => /\bnotify\(/.test(read(`${plugin}/${dir}/${file}`))),
      ),
    );

    expect(callers.filter((plugin) => !listed.includes(plugin)), 'plugins that call notify but are not listed').toEqual([]);
    for (const plugin of listed) {
      expect(read(`${plugin}/README.md`), `${plugin}/README.md does not name ui.toast.delivery`).toContain('ui.toast.delivery');
    }
  });

  it('ships a bug report form whose plugin dropdown lists every plugin directory', () => {
    expect(existsSync(new URL('.github/ISSUE_TEMPLATE/bug_report.md', root))).toBe(false);
    const form = read('.github/ISSUE_TEMPLATE/bug_report.yml').replace(/\r\n/g, '\n');
    const plugins = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/herdr-plugin.toml`, root)))
      .map((entry) => entry.name)
      .sort();
    const block = /- type: dropdown\n(?:(?!\n {2}- type:)[\s\S])*?options:\n((?: {8}- .+\n?)+)/.exec(form);

    expect(block, 'no dropdown with options').not.toBeNull();
    const options = block![1].trim().split('\n').map((line) => line.replace(/^\s*- /, '').trim());
    expect(options.sort()).toEqual(plugins);
    expect(plugins).toHaveLength(11);
    expect(form).toMatch(/^title: '\[Bug\] '$/m);
    expect(form).toMatch(/^labels: \[bug\]$/m);
    for (const id of ['plugin-version', 'herdr-version', 'node-version', 'os']) {
      expect(form).toContain(`id: ${id}`);
    }
  });
});

describe('setup script docs', async () => {
  const { HELP } = await import('../scripts/herdr-setup.ts');
  const section = (title: string): string => HELP.slice(HELP.indexOf(`${title}:`)).split(/\n\n/)[0];
  const commands = [...section('Commands').matchAll(/^ {2}([a-z]+)\b/gm)].map((m) => m[1]);
  const flags = [...new Set([...section('Options').matchAll(/^ {2}(--[a-z-]+)/gm)].map((m) => m[1]))].filter((f) => f !== '--help');

  it('reads the commands and flags from the help text', () => {
    expect(commands).toEqual(['doctor', 'apply', 'install']);
    expect(flags).toEqual(['--ref', '--json', '--yes', '--dry-run']);
  });

  for (const file of ['README.md', 'docs/guide/getting-started.md']) {
    it(`${file} shows every command of --help`, () => {
      const text = read(file);
      for (const command of commands) expect(text, command).toContain(`node scripts/herdr-setup.ts ${command}`);
    });

    it(`${file} names every flag of --help`, () => {
      const text = read(file);
      for (const flag of flags) expect(text, flag).toContain(`\`${flag}`);
    });
  }

  it('points the settings section of the README to apply', () => {
    const readme = read('README.md');
    const settings = readme.slice(readme.indexOf('## herdr settings the plugins rely on'));

    expect(settings).toContain('node scripts/herdr-setup.ts apply');
  });
});
