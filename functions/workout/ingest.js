// Write-side workout endpoints — receives POSTs from Health Auto Export
// (iOS app) on the user's phone after a workout starts/ends and on the
// daily sample-export schedule. Writes to Firestore; the widget reads via
// the separate `workout` HTTP function.
//
// Three endpoints in one file:
//   workoutStart    — fired when a workout starts on Apple Watch
//   workoutEnd      — fired when a workout ends; writes full summary
//   activitySamples — daily dump of per-day active-energy / exercise-minute
//                     / stand-hour samples, for the Move/Exercise/Stand
//                     ring clusters
//
// Firestore layout:
//   auth/workoutIngest   — { token: '<bearer>' } (manually pasted once)
//   data/workout         — widget's single doc: activeWorkout + daily/weekly/
//                          monthly rollups + latest-workout pointer + flags.
//                          Widget reads this via the BaseWidget's Firestore
//                          onSnapshot listener, so every write is a live push.
//   data/activityConfig  — { standHoursAvailable: bool } — latched once HAE
//                          posts a stand-hour sample.
//   workouts/{id}        — per-workout docs (id = hash(type, start, duration))
//   activitySamples/{yyyy-mm-dd} — per-day energy/minutes/stand aggregates
//
// Privacy: workoutEnd recursively strips any `route` / `locations` / similar
// key from the payload before write, per the user's opt-out of GPS data.

const { db } = require('../misc/initFirebase');
const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const crypto = require('crypto');

const BEARER_TOKEN_DOC    = 'auth/workoutIngest';
const WORKOUT_DOC         = 'data/workout';
const ACTIVITY_CONFIG_DOC = 'data/activityConfig';
const WORKOUTS_COLL       = 'workouts';
const ACTIVITY_SAMPLES_COLL = 'activitySamples';

// Apple-ish default goals. Daily values; weekly/monthly scale from these.
const GOAL_DAILY_ENERGY_KCAL   = 600;
const GOAL_DAILY_ACTIVE_MIN    = 30;
const GOAL_DAILY_STAND_HOURS   = 12;
const GOAL_DAILY_WORKOUT_COUNT = 1;

// Recursively strip keys that could contain GPS/route data. Defense in
// depth — HAE should already be configured with routes OFF, but never
// trust the client.
const ROUTE_KEY_DENYLIST = new Set([
	'route', 'routes', 'workoutRoute', 'workoutRoutes',
	'locations', 'gpsLocations', 'coords', 'coordinates',
]);

function stripRouteKeys(obj) {
	if (Array.isArray(obj)) return obj.map(stripRouteKeys);
	if (obj && typeof obj === 'object') {
		const out = {};
		for (const k of Object.keys(obj)) {
			if (ROUTE_KEY_DENYLIST.has(k)) continue;
			out[k] = stripRouteKeys(obj[k]);
		}
		return out;
	}
	return obj;
}

async function validateBearer(req) {
	const header = req.get('authorization') || req.get('Authorization');
	if (!header || header.indexOf('Bearer ') !== 0) return false;
	const token = header.slice(7).trim();
	const tokenDoc = await db.doc(BEARER_TOKEN_DOC).get();
	if (!tokenDoc.exists) return false;
	const expected = tokenDoc.data().token;
	return !!expected && token === expected;
}

// HAE often wraps numeric values as { qty: N, units: '...' }. Accept both.
function normQty(field) {
	if (field == null) return null;
	if (typeof field === 'number' && isFinite(field)) return field;
	if (typeof field === 'object' && 'qty' in field && isFinite(+field.qty)) return +field.qty;
	return null;
}

function workoutIdFor(type, start, duration) {
	return crypto.createHash('sha1').update(type + '|' + start + '|' + duration).digest('hex').slice(0, 16);
}

function normalizeWorkout(w) {
	const type = w.type || w.activityName || w.name || 'unknown';
	const start = w.start || w.startDate || new Date().toISOString();
	const end = w.end || w.endDate || null;
	const duration = normQty(w.duration) || normQty(w.durationSec);
	return {
		type: String(type),
		startIso: String(start),
		endIso: end ? String(end) : null,
		durationSec: duration,
		activeEnergyKcal: normQty(w.activeEnergyBurned || w.activeEnergy),
		totalEnergyKcal: normQty(w.totalEnergyBurned || w.totalEnergy),
		distanceMeters: normQty(w.totalDistance || w.distance),
		elevationMeters: normQty(w.elevationGain || w.totalElevation),
		avgHR: normQty(w.avgHeartRate || w.averageHeartRate),
		maxHR: normQty(w.maxHeartRate),
		deviceName: w.deviceName || w.source || null,
	};
}

// Sum per-day sample values across a date range. Sample docs are keyed
// `YYYY-MM-DD` so a >= lexical compare against the cutoff date works.
function sumSamples(samplesByDate, cutoffDate) {
	let energy = 0, minutes = 0, standHours = 0;
	for (const date in samplesByDate) {
		if (date < cutoffDate) continue;
		const s = samplesByDate[date];
		if (s.activeEnergyKcal) energy += s.activeEnergyKcal;
		if (s.activeMinutes) minutes += s.activeMinutes;
		if (s.standHours) standHours += s.standHours;
	}
	return { energy, minutes, standHours };
}

function countWorkoutsSince(workouts, cutoffIso) {
	let n = 0;
	for (const w of workouts) if (w.startIso && w.startIso >= cutoffIso) n++;
	return n;
}

function dateKeyDaysAgo(n) {
	const d = new Date(Date.now() - n * 86400000);
	return d.toISOString().slice(0, 10);
}

function isoDaysAgo(n) {
	return new Date(Date.now() - n * 86400000).toISOString();
}

// Read last 31 days of workouts + all activity samples, aggregate into
// daily / weekly / monthly buckets, write summary doc.
async function recomputeSummary() {
	const thirtyOneDaysAgoIso = isoDaysAgo(31);

	const [workoutsSnap, samplesSnap, configSnap] = await Promise.all([
		db.collection(WORKOUTS_COLL).where('startIso', '>=', thirtyOneDaysAgoIso).get(),
		db.collection(ACTIVITY_SAMPLES_COLL).get(),
		db.doc(ACTIVITY_CONFIG_DOC).get(),
	]);

	const workouts = [];
	workoutsSnap.forEach(d => workouts.push(d.data()));

	const samplesByDate = {};
	samplesSnap.forEach(d => { samplesByDate[d.id] = d.data(); });

	const standHoursAvailable = configSnap.exists && configSnap.data().standHoursAvailable === true;

	function bucket(days) {
		const cutoffIso = isoDaysAgo(days);
		const cutoffDate = cutoffIso.slice(0, 10);
		const summed = sumSamples(samplesByDate, cutoffDate);
		const workoutCount = countWorkoutsSince(workouts, cutoffIso);
		return {
			activeEnergyKcal: Math.round(summed.energy),
			activeMinutes: Math.round(summed.minutes),
			standHours: standHoursAvailable ? Math.round(summed.standHours) : null,
			workoutCount: workoutCount,
			goalActiveEnergyKcal: GOAL_DAILY_ENERGY_KCAL * days,
			goalActiveMinutes: GOAL_DAILY_ACTIVE_MIN * days,
			goalStandHours: standHoursAvailable ? GOAL_DAILY_STAND_HOURS * days : null,
			goalWorkoutCount: GOAL_DAILY_WORKOUT_COUNT * days,
		};
	}

	const sorted = workouts.slice().sort((a, b) => (a.startIso < b.startIso ? 1 : -1));
	const latest = sorted[0] || null;

	// A fresh recompute always clears activeWorkout — it's only set
	// transiently by workoutStart and cleared again when workoutEnd fires.
	await db.doc(WORKOUT_DOC).set({
		activeWorkout: null,
		daily: bucket(1),
		weekly: bucket(7),
		monthly: bucket(30),
		latest: latest,
		standHoursAvailable: standHoursAvailable,
		timestamp: Date.now(),
	});
}

// Pick the workout envelope out of HAE's payload. HAE sends
// `{ data: { workouts: [...] } }`; tolerate simpler shapes too.
function extractWorkouts(body) {
	if (body && body.data && Array.isArray(body.data.workouts)) return body.data.workouts;
	if (body && Array.isArray(body.workouts)) return body.workouts;
	if (body && body.workout) return [body.workout];
	return [];
}

exports.workoutStart = functions.https.onRequest(async (req, res) => {
	await cors(req, res, async () => {
		if (!(await validateBearer(req))) return res.status(401).send({ error: 'unauthorized' });
		const workouts = extractWorkouts(req.body);
		const w = workouts[0] || req.body || {};
		const type = w.type || w.activityName || w.name;
		const startTime = w.start || w.startDate || new Date().toISOString();
		if (!type) return res.status(400).send({ error: 'missing_type' });
		// Merge into the widget's single doc so the onSnapshot listener
		// sees an activeWorkout field without losing the existing rollups.
		await db.doc(WORKOUT_DOC).set({
			activeWorkout: {
				type: String(type),
				startTime: String(startTime),
				deviceName: w.deviceName || w.source || null,
				ingestedAt: Date.now(),
			},
			timestamp: Date.now(),
		}, { merge: true });
		return res.send({ status: 'active', type: String(type) });
	});
});

exports.workoutEnd = functions.https.onRequest(async (req, res) => {
	await cors(req, res, async () => {
		if (!(await validateBearer(req))) return res.status(401).send({ error: 'unauthorized' });
		const safeBody = stripRouteKeys(req.body || {});
		const raw = extractWorkouts(safeBody);
		if (!raw.length) return res.status(400).send({ error: 'no_workouts_in_payload' });
		let wrote = 0;
		for (const w of raw) {
			const norm = normalizeWorkout(w);
			if (!norm.type || !norm.startIso) continue;
			const id = workoutIdFor(norm.type, norm.startIso, norm.durationSec);
			await db.collection(WORKOUTS_COLL).doc(id).set(Object.assign({ workoutId: id }, norm));
			wrote++;
		}
		// recomputeSummary rewrites data/workout from scratch, clearing any
		// activeWorkout field set by a prior workoutStart.
		await recomputeSummary();
		return res.send({ ingested: wrote });
	});
});

// Normalize HAE metric names to our three slot keys. HAE uses HealthKit's
// snake_case or camelCase identifiers depending on version; match loosely.
function classifyMetric(name) {
	const n = String(name || '').toLowerCase();
	if (n.indexOf('active') !== -1 && n.indexOf('energy') !== -1) return 'activeEnergyKcal';
	if (n.indexOf('exercise') !== -1 && n.indexOf('time') !== -1) return 'activeMinutes';
	if (n.indexOf('stand') !== -1 && n.indexOf('hour') !== -1) return 'standHours';
	if (n === 'apple_exercise_time' || n === 'applexercisetime') return 'activeMinutes';
	if (n === 'apple_stand_hour' || n === 'applestandhour')     return 'standHours';
	return null;
}

exports.activitySamples = functions.https.onRequest(async (req, res) => {
	await cors(req, res, async () => {
		if (!(await validateBearer(req))) return res.status(401).send({ error: 'unauthorized' });
		const safeBody = stripRouteKeys(req.body || {});
		const metrics = (safeBody.data && safeBody.data.metrics) || safeBody.metrics || [];

		// Accumulate per-day per-slot totals in memory, then batch-write.
		const byDay = {};
		let sawStandHours = false;
		for (const metric of metrics) {
			const slot = classifyMetric(metric.name || metric.type);
			if (!slot) continue;
			const samples = metric.data || metric.samples || [];
			for (const s of samples) {
				const rawDate = s.date || s.startDate || '';
				const date = String(rawDate).slice(0, 10);
				if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
				const qty = normQty(s);
				if (qty == null) continue;
				if (!byDay[date]) byDay[date] = {};
				byDay[date][slot] = (byDay[date][slot] || 0) + qty;
				if (slot === 'standHours') sawStandHours = true;
			}
		}

		const batch = db.batch();
		for (const date in byDay) {
			batch.set(db.collection(ACTIVITY_SAMPLES_COLL).doc(date), byDay[date], { merge: true });
		}
		// First time we see stand hours, remember it so the read endpoint
		// knows whether the ring's inner slot is stand-hours or workouts.
		if (sawStandHours) {
			batch.set(db.doc(ACTIVITY_CONFIG_DOC), { standHoursAvailable: true }, { merge: true });
		}
		await batch.commit();
		await recomputeSummary();
		return res.send({ ingestedDays: Object.keys(byDay).length, standHoursAvailable: sawStandHours });
	});
});
