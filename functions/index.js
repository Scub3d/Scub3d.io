// Modules marked `optional: true` are proprietary and gitignored. In local
// development those directories may be absent — we skip them rather than
// crashing the whole emulator at require time.
const modules = [
	{ name: 'alltrails',  path: './alltrails/alltrails',   export: 'alltrails',  optional: true },
	{ name: 'disneyplus', path: './disneyplus/disneyplus', export: 'disneyplus', optional: true },
	{ name: 'github',     path: './github/github',         export: 'github' },
	{ name: 'hulu',       path: './hulu/hulu',             export: 'hulu',       optional: true },
	{ name: 'instagram',  path: './instagram/instagram',   export: 'instagram' },
	{ name: 'league',     path: './riot/league',           export: 'league' },
	{ name: 'netflix',    path: './netflix/netflix',       export: 'netflix',    optional: true },
	{ name: 'mapbox',     path: './mapbox/mapbox',         export: 'mapbox' },
	{ name: 'sketchfab',  path: './sketchfab/sketchfab',   export: 'sketchfab' },
	{ name: 'spotify',    path: './spotify/spotify',       export: 'spotify' },
	{ name: 'steam',      path: './steam/steam',           export: 'steam' },
	// Workout widget — three write endpoints (POSTed by Health Auto Export
	// on the user's phone) + one read endpoint the AR widget calls.
	{ name: 'workoutStart',    path: './workout/ingest',  export: 'workoutStart' },
	{ name: 'workoutEnd',      path: './workout/ingest',  export: 'workoutEnd' },
	{ name: 'activitySamples', path: './workout/ingest',  export: 'activitySamples' },
	{ name: 'workout',         path: './workout/workout', export: 'workout' },
];

for (const m of modules) {
	try {
		exports[m.name] = require(m.path)[m.export];
	} catch (err) {
		if (m.optional && err.code === 'MODULE_NOT_FOUND') {
			console.warn(`[index.js] skipping optional module '${m.name}' (not found locally)`);
			continue;
		}
		throw err;
	}
}