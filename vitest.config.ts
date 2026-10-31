import { defineConfig } from 'vitest/config';

// Tests run from the repository root over every plugin directory (<plugin>/ with its herdr-plugin.toml)
// and the repository tests in test/.
export default defineConfig({
  test: {
    include: ['*/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['node_modules/**', 'coverage/**'],
  },
});
