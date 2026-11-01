// One message and one hint per error class. This file is copied into every plugin that needs it (plugins install
// separately); test/errors-copies.test.ts fails when the copies differ, so edit all copies together. Pure.
export type ErrorClass = 'missing-tool' | 'not-logged-in' | 'no-repository' | 'rate-limit';

export type Classified = { kind: ErrorClass; message: string; hint: string };

export type Notice = { title: string; body: string };

const HINTS: Record<ErrorClass, string> = {
  'missing-tool': 'Install it and make sure it is on your PATH.',
  'not-logged-in': 'Run `gh auth login`.',
  'no-repository': 'Open the pane inside a git repository.',
  'rate-limit': 'Wait until the GitHub rate limit resets, then try again.',
};

const MESSAGES = {
  'not-logged-in': 'gh is not logged in',
  'no-repository': 'not a git repository',
  'rate-limit': 'GitHub rate limit exceeded',
} as const;

const classified = (kind: ErrorClass, message: string): Classified => ({ kind, message, hint: HINTS[kind] });

export const noRepository = (): Classified => classified('no-repository', MESSAGES['no-repository']);

// The notification of a classified error: `<plugin>: <message>` with the hint as body.
export const notice = (plugin: string, found: Classified): Notice => ({ title: `${plugin}: ${found.message}`, body: found.hint });

// One line for inline reasons (popup text, return values): message, then hint.
export const describe = (found: Classified): string => `${found.message}. ${found.hint}`;

export const missingTool = (tool: string): Classified => classified('missing-tool', `${tool} is not installed`);

// The error class of the text of a failure (stderr, or the message of a thrown error); null when it is none of them.
export function classifyText(text: string): Classified | null {
  if (/rate limit/i.test(text)) return classified('rate-limit', MESSAGES['rate-limit']);
  if (/not logged in|gh auth login|authentication required|requires authentication|bad credentials/i.test(text)) {
    return classified('not-logged-in', MESSAGES['not-logged-in']);
  }
  if (/not a git repository/i.test(text)) return classified('no-repository', MESSAGES['no-repository']);
  const tool = /spawn (\S+) ENOENT/.exec(text)?.[1] ?? /^(\S+) is not installed$/m.exec(text)?.[1];
  if (tool) return missingTool(tool);
  const shell = /^(?:\S+: )?(\S+): command not found/m.exec(text)?.[1] ?? /'(\S+)' is not recognized/.exec(text)?.[1];
  return shell ? missingTool(shell) : null;
}

// The error class of a failed command: its spawn error code (ENOENT = tool missing) and stderr.
export function classifyFailure(command: string, code: string | number | null, stderr: string): Classified | null {
  if (command === 'gh' && code === 4) return classified('not-logged-in', MESSAGES['not-logged-in']);
  if (code === 'ENOENT') return missingTool(command.replace(/^.*[\\/]/, '').replace(/\.exe$/i, ''));
  return classifyText(stderr);
}

// The notification of `text` for `plugin`: the shared message and hint for a known class, else `fallbackTitle`
// with `text` as the body.
export function noticeFor(plugin: string, text: string, fallbackTitle: string): Notice {
  const found = classifyText(text);
  return found ? notice(plugin, found) : { title: fallbackTitle, body: text };
}
