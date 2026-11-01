export type OpenCommand = { command: string; args: string[] };

// Command and arguments that open a URL in the default browser. The URL is always one
// argument and is run without a shell (execFile), so `&`, `%` and quotes stay unchanged.
export function opener(platform: NodeJS.Platform, url: string): OpenCommand | null {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'linux') return { command: 'xdg-open', args: [url] };
  if (platform === 'win32') return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };
  return null;
}
