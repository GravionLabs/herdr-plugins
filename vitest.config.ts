import { defineConfig } from 'vitest/config';

// Tests run from the repository root over every plugin directory (<plugin>/ with its herdr-plugin.toml)
// and the repository tests in test/.
export default defineConfig({
  test: {
    include: ['*/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['node_modules/**', 'coverage/**'],
    coverage: {
      // on for every run, so `npm test` prints the coverage table in the CI log of each OS
      enabled: true,
      provider: 'v8',
      reporter: ['text'],
      include: ['**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'node_modules/**', 'coverage/**', 'vitest.config.ts'],
      thresholds: { statements: 0, branches: 0, functions: 0, lines: 0 },
    },
  },
});
