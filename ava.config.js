const config = {
	extensions: ['ts'],
	nodeArguments: ['--import=tsx'],
	files: ['test/**/*.spec.ts'],
	concurrency: 10,
	failFast: true,
};

export default config;
