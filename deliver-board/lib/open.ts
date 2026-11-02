export type OpenCommand = { command: string; args: string[] };

// Only absolute http(s) URLs are opened: `file:`, `javascript:`, a path or a leading `-` (an option of `open`)
// would make the opener start a program or read a local file. Whitespace and control characters are refused too.
export function isWebUrl(url: string): boolean {
  return /^https?:\/\/[^\s\x00-\x1f\x7f]+$/i.test(url) && URL.canParse(url);
}

// Command and arguments that open a URL in the default browser, or null for a URL that is not a web URL
// (`isWebUrl`) or an unsupported platform. The URL is always one argument and is run without a shell (execFile),
// so `;`, `&`, `%` and quotes stay unchanged.
export function opener(platform: NodeJS.Platform, url: string): OpenCommand | null {
  if (!isWebUrl(url)) return null;
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'linux') return { command: 'xdg-open', args: [url] };
  if (platform === 'win32') return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };
  return null;
}
