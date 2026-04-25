// Apple Fitness metric palette — each workout stat has its own hue in
// Apple's detail view, which makes the grid instantly scannable. We reuse
// the same mapping so users' muscle memory transfers from the Fitness app.
const STAT_COLORS = {
	time:      '#FFCC00', // workout time / elapsed time — yellow
	distance:  '#32ADE6', // distance — cyan/blue
	energy:    '#FF2D55', // active/total calories — red
	hr:        '#FF2D55', // heart rate — red (matches energy family)
	pace:      '#FF375F', // pace — magenta/pink
	cadence:   '#32ADE6', // cadence — blue (same family as distance)
	elevation: '#34C759', // elevation gain — green
	power:     '#34C759', // power — green (running power)
};

class WorkoutWidget extends BaseWidget {
	dataDocumentID = 'workout';
	updateIntervalMS = 300000; // 5 min — widget wants to pick up active-workout transitions reasonably fast
	data;

	// Placeholder figure canvas dimensions. Rendered via drawWorkoutFigure
	// in static/ar/js/misc/stickFigure.js; the 2D canvas is wrapped in a
	// CanvasTexture for the active-face plane. Resolution set high enough
	// that the figure stays crisp at AR viewing distance.
	figureCanvasWidth = 512;
	figureCanvasHeight = 512;

	// Widget background — dark, like watchOS Fitness.
	backgroundRGB = [0.06, 0.07, 0.09];

	// Dev flag: when true, any ring cluster without real data gets
	// randomized progress so the widget reads as "filled" during layout
	// review. Flip to false once Health Auto Export is writing real data.
	useDemoData = true;

	// Demo workout toggle — flip between 'run' and 'climbing' to preview
	// how the right-side latest-workout zone renders for a run (lots of
	// metrics: distance/pace/cadence/elevation) vs an indoor workout with
	// fewer numbers (duration/kcal/HR only).
	demoWorkoutType = 'run'; // 'run' | 'climbing'

	constructor(db, storage) {
		super(db, storage);
		this.data = new WorkoutData();
	}

	// Override so the widget always builds on the very first Firestore
	// snapshot, even if the incoming data is empty (no workouts yet).
	// BaseWidget's default flow short-circuits on Equals true, which for
	// a brand-new widget with no Firestore doc yet means the widget never
	// builds and the card's loading animation never finishes.
	async checkIfShouldUpdateWidget(newJSON) {
		if (!this.hasWidgetBeenCreatedForTheFirstTime) {
			this.data = this.data.fromJSON(newJSON);
			await this.generateAFrameWidget();
			var raycasterEl = AFRAME.scenes[0].querySelector('[raycaster]');
			if (raycasterEl) raycasterEl.components.raycaster.refreshObjects();
			return;
		}
		return super.checkIfShouldUpdateWidget(newJSON);
	}

	async generateAFrameHTML() {
		// Root
		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');
		$('#' + this.dataDocumentID + 'Widget').attr(
			'position',
			(this.xPositionModifier * 1) + ' 0 ' + (this.zPositionModifier * 3)
		);

		// Body — dark rounded rectangle behind everything.
		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');
		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0 0 0');
		$('#' + this.dataDocumentID + 'WidgetBody').attr(
			'material',
			'shader: color-rounded-corners; transparent: false; color: ' +
			this.backgroundRGB[0] + ' ' + this.backgroundRGB[1] + ' ' + this.backgroundRGB[2] +
			'; multiplier: 1; aspectRatio: ' + (128.0 / 512.0)
		);

		// Both faces build up front; toggleFace flips visibility based on
		// activeWorkout presence. Keeps the rebuild cheap when HAE pushes
		// a start/end transition.
		await this._buildActiveFace();
		await this._buildInactiveFace();
		this._toggleFace();
	}

	async applyUpdate(oldData, newData) {
		// Cheapest update path: the face toggles via visibility. Field
		// values inside the faces get stale, but since updates on this
		// widget are infrequent (a workout start/end or a daily sample
		// push), forcing a full rebuild is simpler than surgical patches.
		return false;
	}

	_toggleFace() {
		const active = !!(this.data && this.data.activeWorkout);
		$('#' + this.dataDocumentID + 'WidgetActiveFace').attr('visible', active);
		$('#' + this.dataDocumentID + 'WidgetInactiveFace').attr('visible', !active);
	}

	// --- ACTIVE FACE ------------------------------------------------------
	// Shown while a workout is in progress. Left quarter = placeholder
	// figure for the activity type. Right 3 quarters = activity name +
	// live-ticking elapsed timer.
	async _buildActiveFace() {
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetActiveFace',
			rotation: '0 0 0',
			scale: '1 1 1',
			visible: false,
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		const activeWorkout = (this.data && this.data.activeWorkout) || null;
		const type = activeWorkout ? activeWorkout.type : 'default';
		const startTime = activeWorkout ? activeWorkout.startTime : null;

		// Figure plane at the left quarter (centered around x = -0.375).
		// The widget's scale '2 0.5 2' stretches local X by 2 and local Y by
		// 0.5 — a net 4:1 horizontal squish — so a plane we want to render
		// visually SQUARE needs local height = 4 × local width to compensate.
		const figureCanvas = document.createElement('canvas');
		figureCanvas.width = this.figureCanvasWidth;
		figureCanvas.height = this.figureCanvasHeight;
		const figCtx = figureCanvas.getContext('2d');
		const poseKey = this._poseKeyForType(type);
		drawWorkoutFigure(figCtx, poseKey, figureCanvas.width, figureCanvas.height, {
			background: this._bgHex(),
		});
		const figureTexture = new THREE.CanvasTexture(figureCanvas);
		figureTexture.generateMipmaps = false;
		figureTexture.minFilter = THREE.LinearFilter;
		figureTexture.magFilter = THREE.LinearFilter;
		figureTexture.needsUpdate = true;

		const figurePlane = new THREE.Mesh(
			new THREE.PlaneGeometry(0.06, 0.24),
			new THREE.MeshBasicMaterial({ map: figureTexture, transparent: true })
		);
		figurePlane.position.set(-0.375, 0, 0.002);
		const figureHolder = new THREE.Object3D();
		figureHolder.add(figurePlane);

		// Attach to A-Frame via an object3D wrapper entity.
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetActiveFigure',
		}).appendTo('#' + this.dataDocumentID + 'WidgetActiveFace');
		$('#' + this.dataDocumentID + 'WidgetActiveFigure')[0].object3D.add(figureHolder);

		// Activity type name — big, right of the figure.
		await generateAFrameTextEntity(
			this.dataDocumentID + 'WidgetActiveTypeText',
			'#' + this.dataDocumentID + 'WidgetActiveFace',
			this._prettyType(type),
			36, '#eaf6ee', 12,
			'Montserrat', 500, 48, false, '#00000000',
			150, 22, 340, 512, 128, 1, false
		);

		// Live timer text — updated each second via an A-Frame tick component.
		await generateAFrameTextEntity(
			this.dataDocumentID + 'WidgetActiveTimerText',
			'#' + this.dataDocumentID + 'WidgetActiveFace',
			'0:00',
			64, '#34c759', 16,
			'Montserrat', 400, 64, false, '#00000000',
			150, -30, 340, 512, 128, 1, false
		);

		// Register a tick loop to refresh the timer while the active face
		// is visible. Pushed to cleanupFunctions so widget teardown cancels it.
		if (startTime) {
			const startMs = new Date(startTime).getTime();
			let lastSec = -1;
			const tick = () => {
				if (!document.getElementById(this.dataDocumentID + 'WidgetActiveTimerText')) return;
				const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
				if (elapsed === lastSec) return;
				lastSec = elapsed;
				// Text entity is an <a-image> with a pre-baked texture, so we
				// can't update it cheaply. Defer the live-timer rebuild to v2
				// once we switch to an <a-text> primitive for the numeric.
				// For now the visible timer snapshots to the value at widget
				// build time — full rebuild on the next poll interval keeps
				// it roughly in sync.
			};
			const intervalId = setInterval(tick, 1000);
			this.cleanupFunctions.push(() => clearInterval(intervalId));
		}
	}

	// --- INACTIVE FACE ----------------------------------------------------
	// Shown when no workout is active. Three concentric ring clusters
	// (daily / weekly / monthly) + a small latest-workout breadcrumb on
	// the right.
	async _buildInactiveFace() {
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetInactiveFace',
			rotation: '0 0 0',
			scale: '1 1 1',
			visible: false,
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		// Two zones across the 4:1 face now:
		//   x = -0.375 — today's ring cluster (Move/Exercise/Stand rings,
		//                no label — the ring shape reads on its own).
		//   right 3/4 — latest workout: figure, type, when, hero stats row,
		//                type-specific secondary row.
		// Counter-scale on the cluster is Y × 4 so the widget's 4:1 squish
		// renders as a circle.
		const CLUSTER_SCALE = 0.15;
		const RING_X = -0.375;

		// --- Today's ring cluster (no text label) ---
		const clusterGroup = new RingCluster();
		const clusterData = this.data ? this.data.ringCluster('daily') : null;
		if (clusterData) {
			clusterGroup.setProgress(clusterData);
		} else if (this.useDemoData) {
			clusterGroup.setProgress(this._demoCluster({ min: 0.30, max: 0.95 }));
		}
		clusterGroup.group.scale.set(CLUSTER_SCALE, CLUSTER_SCALE * 4, CLUSTER_SCALE);
		$('<a-entity/>', { id: this.dataDocumentID + 'WidgetRingsDaily' }).appendTo('#' + this.dataDocumentID + 'WidgetInactiveFace');
		$('#' + this.dataDocumentID + 'WidgetRingsDaily').attr('position', RING_X + ' 0 0.0001');
		$('#' + this.dataDocumentID + 'WidgetRingsDaily')[0].object3D.add(clusterGroup.group);

		// --- Latest workout zone (fills the right 3/4) ---
		await this._buildLatestWorkoutZone();
	}

	// Right-of-rings zone: figure + workout type + date + two stat rows.
	// Layout (local-X coords across the 4:1 face):
	//   -0.17  figure (square, ~0.08 world wide)
	//    0.05  title + date stack
	//    0.15  hero stats row (duration · distance · kcal · HR)
	//    0.15  secondary row (pace · cadence · elevation)
	async _buildLatestWorkoutZone() {
		const workout = (this.data && this.data.latest) ||
			(this.useDemoData ? this._demoLatestWorkout() : null);
		const poseType = workout ? workout.type : 'default';

		// --- Vertical divider between the rings (1:1 left zone) and the
		// activity details (3:1 right zone). Scale (0.003, 1, 1) keeps it
		// a hair-thin vertical that spans the full body height. ---
		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetDivider',
			color: '#3a3f47',
		}).appendTo('#' + this.dataDocumentID + 'WidgetInactiveFace');
		$('#' + this.dataDocumentID + 'WidgetDivider').attr('position', '-0.25 0 0.0001');
		$('#' + this.dataDocumentID + 'WidgetDivider').attr('scale', '0.003 1 1');

		// --- Icon + activity name stack (left of the 3:1 zone) ---
		// Icon canvas: olive-green circle + Unicode activity emoji as a
		// temporary placeholder. Unicode emoji are OS-rendered (not
		// Apple-IP), so they're safe to ship. When licensed or custom
		// icons are ready, swap `_drawActivityIcon` for a direct image
		// load (`fetch(url) → <img> → CanvasTexture`).
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 256;
		this._drawActivityIcon(canvas, poseType);
		const tex = new THREE.CanvasTexture(canvas);
		tex.generateMipmaps = false;
		tex.minFilter = THREE.LinearFilter;
		tex.magFilter = THREE.LinearFilter;
		// Counter-scale for the 4:1 horizontal squish: local height = 4 ×
		// local width to render as a visual square.
		const plane = new THREE.Mesh(
			new THREE.PlaneGeometry(0.035, 0.14),
			new THREE.MeshBasicMaterial({ map: tex, transparent: true })
		);
		$('<a-entity/>', { id: this.dataDocumentID + 'WidgetLatestFigure' }).appendTo('#' + this.dataDocumentID + 'WidgetInactiveFace');
		$('#' + this.dataDocumentID + 'WidgetLatestFigure').attr('position', '-0.125 0.05 0.0001');
		$('#' + this.dataDocumentID + 'WidgetLatestFigure')[0].object3D.add(plane);

		if (!workout) return;

		// Activity name below the icon. Centered within the left side of
		// the 3:1 zone (xFrac=-0.125). Smaller + narrower textHolder than
		// the previous "title" since the zone is tighter here.
		const nameX = -0.125;
		const nameHolder = 150;
		await generateAFrameTextEntity(
			this.dataDocumentID + 'WidgetLatestType',
			'#' + this.dataDocumentID + 'WidgetInactiveFace',
			this._prettyType(workout.type),
			13, '#eaf6ee', 4,
			'Montserrat', 700, 16, true, '#00000000',
			(nameX + 0.5) * 512 - nameHolder / 2, -18, nameHolder, 512, 128, 1, false
		);

		// --- Stats grid (Apple Fitness palette, horizontal layout) ---
		// Two layouts depending on whether the workout has route metrics
		// (distance / elevation / pace):
		//
		//   Route workout (run, hike, outdoor bike, …)
		//     Top: Workout Time · Active Calories · Distance
		//     Bot: Avg HR · Elevation Gain · Avg Pace
		//   Indoor workout (climbing, strength, yoga, …)
		//     Top: Workout Time · Active Calories
		//     Bot: Total Calories · Avg HR
		//
		// The rationale: runs expose enough additional metrics that total
		// calories becomes redundant noise and pace earns a dedicated row
		// slot. Indoors, there's less to show so total calories stays.
		const hasRouteMetrics = !!(workout.distanceMeters || workout.elevationMeters || workout.avgPaceSecPerKm);

		const topStats = [];
		const botStats = [];
		if (workout.durationSec) {
			topStats.push({ id: 'Time', value: this._formatDuration(workout.durationSec), label: 'TIME', color: STAT_COLORS.time });
		}
		// Active calories always shown as its own cell. Total calories
		// only surfaces as a separate cell on indoor workouts (no route
		// metrics) — on runs/hikes the additional distance/elev/pace
		// stats carry more signal than total, so total gets dropped.
		if (workout.activeEnergyKcal) {
			topStats.push({ id: 'ActCal', value: Math.round(workout.activeEnergyKcal) + 'cal', label: 'ACTIVE', color: STAT_COLORS.energy });
		}

		if (hasRouteMetrics) {
			if (workout.distanceMeters) {
				topStats.push({ id: 'Dist', value: (workout.distanceMeters / 1000).toFixed(2) + 'km', label: 'DISTANCE', color: STAT_COLORS.distance });
			}
			if (workout.avgHR) {
				botStats.push({ id: 'HR', value: Math.round(workout.avgHR) + 'bpm', label: 'AVG HR', color: STAT_COLORS.hr });
			}
			if (workout.elevationMeters) {
				botStats.push({ id: 'Elev', value: Math.round(workout.elevationMeters) + 'm', label: 'ELEV GAIN', color: STAT_COLORS.elevation });
			}
			if (workout.avgPaceSecPerKm) {
				botStats.push({ id: 'Pace', value: this._formatPaceValue(workout.avgPaceSecPerKm) + '/km', label: 'AVG PACE', color: STAT_COLORS.pace });
			}
		} else {
			if (workout.totalEnergyKcal) {
				botStats.push({ id: 'TotCal', value: Math.round(workout.totalEnergyKcal) + 'cal', label: 'TOTAL', color: STAT_COLORS.energy });
			}
			if (workout.avgHR) {
				botStats.push({ id: 'HR', value: Math.round(workout.avgHR) + 'bpm', label: 'AVG HR', color: STAT_COLORS.hr });
			}
		}

		// 4 fixed slots across the stats zone. Visible stats get centered
		// within the row — 2-stat rows end up in slots [1, 2] rather than
		// hard-left — so a climbing session (2 per row) sits as a tidy
		// 2×2 grid instead of being left-skewed.
		await this._placeStatRow(topStats, 22);
		await this._placeStatRow(botStats, -15);
	}

	// Places a row of stat cells horizontally-centered within a 4-slot
	// grid. Callers pass the (already-filtered-to-present) list of stats
	// and a row y-offset.
	async _placeStatRow(stats, yValue) {
		if (!stats.length) return;
		const CELL_XS = [0.09, 0.22, 0.35, 0.48];
		const offset = Math.floor((CELL_XS.length - stats.length) / 2);
		for (let i = 0; i < stats.length && (offset + i) < CELL_XS.length; i++) {
			const stat = stats[i];
			await this._buildStatCell(stat.id, CELL_XS[offset + i], yValue, stat.value, stat.label, stat.color);
		}
	}

	// Each cell: colored value (large, bold) on top, gray label below.
	// Matches Apple Fitness's "value is the hero" treatment — value
	// dominates visually, label confirms what it is.
	async _buildStatCell(id, xFrac, yValue, value, label, color) {
		const HOLDER = 72;
		await generateAFrameTextEntity(
			this.dataDocumentID + 'WidgetStat' + id + 'V',
			'#' + this.dataDocumentID + 'WidgetInactiveFace',
			value,
			14, color, 4,
			'Montserrat', 700, 18, true, '#00000000',
			(xFrac + 0.5) * 512 - HOLDER / 2, yValue, HOLDER, 512, 128, 1, false
		);
		await generateAFrameTextEntity(
			this.dataDocumentID + 'WidgetStat' + id + 'L',
			'#' + this.dataDocumentID + 'WidgetInactiveFace',
			label,
			8, '#8b949e', 4,
			'Montserrat', 600, 10, true, '#00000000',
			(xFrac + 0.5) * 512 - HOLDER / 2, yValue - 14, HOLDER, 512, 128, 1, false
		);
	}

	// Synthesized latest-workout for layout preview. Two fixtures the user
	// provided — a run (lots of metrics) and a climbing session (only
	// duration/kcal/HR). Toggle via `this.demoWorkoutType`.
	_demoLatestWorkout() {
		if (this.demoWorkoutType === 'climbing') {
			return {
				type: 'Climbing',
				startIso: new Date(Date.now() - 1 * 86400000).toISOString(),
				durationSec: 4351,            // 1:12:31
				activeEnergyKcal: 502,
				totalEnergyKcal: 647,
				avgHR: 115,
			};
		}
		// Run (default)
		return {
			type: 'Outdoor Run',
			startIso: new Date(Date.now() - 3 * 86400000).toISOString(),
			durationSec: 3579,                // 0:59:39
			activeEnergyKcal: 871,
			totalEnergyKcal: 985,
			distanceMeters: 11020,            // 11.02 km
			elevationMeters: 37,
			avgHR: 167,
			avgPaceSecPerKm: 325,             // 5'25"
			avgCadenceSpm: 158,
		};
	}

	_formatDuration(sec) {
		const total = Math.max(0, Math.round(sec));
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		const pad = (n) => (n < 10 ? '0' + n : String(n));
		if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
		return m + ':' + pad(s);
	}

	_formatDistanceKm(meters) {
		const km = meters / 1000;
		return km.toFixed(2) + ' KM';
	}

	_formatPace(secPerKm) {
		const m = Math.floor(secPerKm / 60);
		const s = Math.round(secPerKm % 60);
		const pad = (n) => (n < 10 ? '0' + n : String(n));
		return m + '\'' + pad(s) + '"/KM';
	}

	// Value-only pace (no "/KM" suffix) — the unit ends up as a separate
	// gray label below in the stat-cell layout.
	_formatPaceValue(secPerKm) {
		const m = Math.floor(secPerKm / 60);
		const s = Math.round(secPerKm % 60);
		const pad = (n) => (n < 10 ? '0' + n : String(n));
		return m + '\'' + pad(s) + '"';
	}

	// Placeholder activity icon: olive-green circle + Unicode activity
	// emoji. Emoji ship with the operating system (OS-rendered) so there
	// are no licensing concerns bundling them. This is a stand-in for
	// real artwork — when custom icons are ready, replace the emoji
	// lookup with an <img>/CanvasTexture pipeline pointed at the asset.
	_drawActivityIcon(canvas, type) {
		const ctx = canvas.getContext('2d');
		const w = canvas.width;
		const h = canvas.height;
		const cx = w / 2, cy = h / 2;
		const r = Math.min(w, h) / 2 * 0.92;

		ctx.clearRect(0, 0, w, h);
		// Olive background circle — ring-tier dark green to echo the
		// Move/Exercise/Stand palette without cloning Apple's exact shade.
		ctx.fillStyle = '#2e3a1a';
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();

		const emojiByPose = {
			running:       '🏃',  // 🏃
			walking:       '🚶',  // 🚶
			hiking:        '🥾',  // 🥾
			climbing:      '🧗',  // 🧗
			yoga:          '🧘',  // 🧘
			pilates:       '🤸',  // 🤸
			weightlifting: '🏋',  // 🏋
			hiit:          '💪',  // 💪
			default:       '★',        // ★
		};
		const pose = this._poseKeyForType(type);
		const emoji = emojiByPose[pose] || emojiByPose.default;
		const fontSize = r * 1.15;
		ctx.font = 'bold ' + fontSize + 'px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		// Small vertical nudge — many emoji fonts render glyphs slightly
		// above their cell center.
		ctx.fillText(emoji, cx, cy + fontSize * 0.04);
	}

	// Pose name normalization — HealthKit type strings come in various
	// casings, and Apple Fitness adds qualifiers like "Outdoor Run" or
	// "Indoor Climbing". Match against the core activity noun (substring)
	// so those qualifiers don't break the icon/emoji lookup.
	_poseKeyForType(type) {
		if (!type) return 'default';
		const n = String(type).toLowerCase()
			.replace(/^hkworkoutactivitytype/, '')
			.replace(/[^a-z]/g, '');
		if (n.indexOf('run') !== -1)                                        return 'running';
		if (n.indexOf('walk') !== -1)                                       return 'walking';
		if (n.indexOf('hik') !== -1)                                        return 'hiking';
		if (n.indexOf('climb') !== -1)                                      return 'climbing';
		if (n.indexOf('yoga') !== -1)                                       return 'yoga';
		if (n.indexOf('pilates') !== -1)                                    return 'pilates';
		if (n.indexOf('hiit') !== -1 || n.indexOf('highintensity') !== -1)  return 'hiit';
		if (n.indexOf('strength') !== -1 || n.indexOf('weight') !== -1)     return 'weightlifting';
		return 'default';
	}

	_prettyType(type) {
		const clean = String(type || '').replace(/^HKWorkoutActivityType/, '');
		// Insert space before capitals: "TraditionalStrengthTraining" → "Traditional Strength Training"
		return clean.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
	}

	_bgHex() {
		const r = Math.round(this.backgroundRGB[0] * 255);
		const g = Math.round(this.backgroundRGB[1] * 255);
		const b = Math.round(this.backgroundRGB[2] * 255);
		return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
	}

	// Demo helper — produces randomized per-ring progress within `bounds`
	// ({min, max}). Each ring's progress is independent so we don't get
	// three identical arcs per cluster.
	_demoCluster(bounds) {
		const rand = () => bounds.min + Math.random() * (bounds.max - bounds.min);
		return {
			move:     { progress: rand(), goal: 1 },
			exercise: { progress: rand(), goal: 1 },
			stand:    { progress: rand(), goal: 1 },
		};
	}

	_agoLabel(iso) {
		if (!iso) return 'recently';
		const then = new Date(iso).getTime();
		const days = Math.floor((Date.now() - then) / 86400000);
		if (days <= 0) return 'today';
		if (days === 1) return 'yesterday';
		return days + ' days ago';
	}
}
