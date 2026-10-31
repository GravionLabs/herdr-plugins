// Pure trimming of a clicked URL: removes trailing punctuation that terminal URL detection
// picks up from the surrounding text. No herdr or Node I/O here, so it is testable on its own.

const PLAIN = new Set(['.', ',', ';', ':', "'", '"']);
const OPENER_FOR_CLOSER = { ')': '(', ']': '[' };

function count(text, char) {
  return text.split(char).length - 1;
}

export function trimTrailingPunctuation(input) {
  let url = String(input ?? '');
  for (;;) {
    const last = url.slice(-1);
    if (PLAIN.has(last)) {
      url = url.slice(0, -1);
      continue;
    }
    const opener = OPENER_FOR_CLOSER[last];
    // A closing bracket is kept when the URL holds its opening partner (e.g. Wikipedia "Foo_(bar)").
    if (opener && count(url, last) > count(url, opener)) {
      url = url.slice(0, -1);
      continue;
    }
    return url;
  }
}
