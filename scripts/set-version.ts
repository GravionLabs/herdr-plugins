// Writes one release version into every <plugin>/herdr-plugin.toml and into package.json.
// Usage: node scripts/set-version.ts <version>   (falls back to $VERSION; run from the repository root)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const semver = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

export function setVersion(root: string, version: string): string[] {
  if (!semver.test(version)) throw new Error(`'${version}' is not a SemVer version (no v prefix)`);
  const changed: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const file = join(root, entry.name, 'herdr-plugin.toml');
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // the top-level `version` key only, never one inside a table
    const head = text.search(/^\[/m);
    const split = head === -1 ? text.length : head;
    const top = text.slice(0, split);
    if (!/^version\s*=\s*"[^"]*"/m.test(top)) throw new Error(`${file} has no top-level version`);
    writeFileSync(file, top.replace(/^(version\s*=\s*)"[^"]*"/m, `$1"${version}"`) + text.slice(split));
    changed.push(file);
  }

  const pkgFile = join(root, 'package.json');
  const pkg = readFileSync(pkgFile, 'utf8');
  if (!/^(\s*"version":\s*)"[^"]*"/m.test(pkg)) throw new Error(`${pkgFile} has no version`);
  writeFileSync(pkgFile, pkg.replace(/^(\s*"version":\s*)"[^"]*"/m, `$1"${version}"`));
  changed.push(pkgFile);
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const version = process.argv[2] ?? process.env.VERSION ?? '';
    const changed = setVersion(process.cwd(), version);
    console.log(`Set version ${version} in ${changed.length} files`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
