import { describe, expect, it } from 'vitest';
import { trimTrailingPunctuation } from '../lib/trim.mjs';

describe('trimTrailingPunctuation', () => {
  it('removes a trailing ) that has no opening partner', () => {
    expect(trimTrailingPunctuation('https://github.com/GravionLabs/ci/pull/91)')).toBe(
      'https://github.com/GravionLabs/ci/pull/91',
    );
  });

  it('removes ) and then . repeatedly', () => {
    expect(trimTrailingPunctuation('https://github.com/GravionLabs/ci/pull/91).')).toBe(
      'https://github.com/GravionLabs/ci/pull/91',
    );
  });

  it('removes ] and , repeatedly', () => {
    expect(trimTrailingPunctuation('https://github.com/GravionLabs/ci/issues/5],')).toBe(
      'https://github.com/GravionLabs/ci/issues/5',
    );
  });

  it('keeps a closing ) that has its opening partner in the URL', () => {
    expect(trimTrailingPunctuation('https://en.wikipedia.org/wiki/Foo_(bar)')).toBe(
      'https://en.wikipedia.org/wiki/Foo_(bar)',
    );
  });

  it('keeps the balanced ) and removes the extra one', () => {
    expect(trimTrailingPunctuation('https://en.wikipedia.org/wiki/Foo_(bar))')).toBe(
      'https://en.wikipedia.org/wiki/Foo_(bar)',
    );
  });

  it('removes trailing ; : quote characters', () => {
    expect(trimTrailingPunctuation('https://example.com/a;:\'"')).toBe('https://example.com/a');
  });

  it('leaves a URL without trailing punctuation unchanged', () => {
    expect(trimTrailingPunctuation('https://github.com/GravionLabs/ci/pull/91')).toBe(
      'https://github.com/GravionLabs/ci/pull/91',
    );
  });

  it('returns an empty string for empty or missing input', () => {
    expect(trimTrailingPunctuation('')).toBe('');
    expect(trimTrailingPunctuation(undefined)).toBe('');
  });
});
