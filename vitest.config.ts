import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['test/**/*.spec.ts'],
		bail: 1, // stop on the first failing test
		testTimeout: 30_000,
		// In CI, also emit a JUnit report for Codecov Test Analytics; local runs keep the default reporter.
		reporters: process.env.CI ? ['default', 'junit'] : ['default'],
		outputFile: { junit: './test-report.junit.xml' },
		// Vitest runs test files in parallel workers but tests within a file
		// sequentially by default, which keeps shared per-file state safe.
		coverage: { provider: 'v8', reporter: ['text', 'lcov'], include: ['src/**'] },
	},
});
