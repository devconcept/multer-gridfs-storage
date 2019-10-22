module.exports.default = {
	sources: ['app.js', 'routes.js', 'settings.js'],
	files: ['test/**/*.spec.js'],
	helpers: ['test/helpers.js'],
	cache: true,
	concurrency: 10,
	verbose: true,
	tap: false,
	failFast: true
};
