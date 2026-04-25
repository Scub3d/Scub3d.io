// Apple-style workout figures, 2D canvas-drawn. Each pose is a hand-composed
// drawing matching the Apple Watch workout illustration for that activity.
// Renders to any caller-provided 2D context at any size; the widget wraps
// that canvas in a CanvasTexture to display on a plane.
//
// Coordinate convention: pose drawers use normalized [0,1] × [0,1] space.
// The top-level `drawWorkoutFigure` scales to the canvas's pixel dims, so
// all poses look consistent across widget face sizes.

(function(global) {
	'use strict';

	const APPLE_GREEN = '#34c759';

	// Stroke widths + head radius in normalized units. Tuned so a figure
	// reads as Apple-chunky (not hairline-thin stick person).
	const LIMB_WIDTH = 0.07;
	const TORSO_WIDTH = 0.11;
	const HEAD_RADIUS = 0.085;

	function drawWorkoutFigure(ctx, poseName, width, height, options) {
		options = options || {};
		const color = options.color || APPLE_GREEN;
		ctx.save();
		ctx.clearRect(0, 0, width, height);
		if (options.background) {
			ctx.fillStyle = options.background;
			ctx.fillRect(0, 0, width, height);
		}
		ctx.fillStyle = color;
		ctx.strokeStyle = color;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		const drawFn = POSE_DRAWERS[poseName] || POSE_DRAWERS.default;
		drawFn(ctx, width, height);
		ctx.restore();
	}

	// --- Drawing helpers (normalized coords) -------------------------------

	function head(ctx, x, y, w, h, r) {
		const scale = Math.min(w, h);
		ctx.beginPath();
		ctx.arc(x * w, y * h, (r || HEAD_RADIUS) * scale, 0, Math.PI * 2);
		ctx.fill();
	}

	function limb(ctx, x1, y1, x2, y2, w, h, width) {
		const scale = Math.min(w, h);
		ctx.lineWidth = (width || LIMB_WIDTH) * scale;
		ctx.beginPath();
		ctx.moveTo(x1 * w, y1 * h);
		ctx.lineTo(x2 * w, y2 * h);
		ctx.stroke();
	}

	// Joint with an elbow/knee — quadratic curve via a mid-control point.
	// Makes bent limbs read as curved rather than jagged polylines.
	function jointed(ctx, x1, y1, cx, cy, x2, y2, w, h, width) {
		const scale = Math.min(w, h);
		ctx.lineWidth = (width || LIMB_WIDTH) * scale;
		ctx.beginPath();
		ctx.moveTo(x1 * w, y1 * h);
		ctx.lineTo(cx * w, cy * h);
		ctx.lineTo(x2 * w, y2 * h);
		ctx.stroke();
	}

	function circle(ctx, x, y, r, w, h) {
		const scale = Math.min(w, h);
		ctx.beginPath();
		ctx.arc(x * w, y * h, r * scale, 0, Math.PI * 2);
		ctx.fill();
	}

	function box(ctx, x, y, bw, bh, w, h) {
		ctx.fillRect(x * w, y * h, bw * w, bh * h);
	}

	// --- Poses ------------------------------------------------------------
	// Each pose is a function that draws onto an already-configured ctx.
	// Drawers use normalized [0,1] × [0,1] so poses translate cleanly
	// across canvas dimensions.

	const POSE_DRAWERS = {
		// Neutral standing, arms slightly out — generic "workout" silhouette.
		default(ctx, w, h) {
			limb(ctx, 0.50, 0.30, 0.50, 0.62, w, h, TORSO_WIDTH);
			limb(ctx, 0.50, 0.33, 0.34, 0.56, w, h);
			limb(ctx, 0.50, 0.33, 0.66, 0.56, w, h);
			limb(ctx, 0.50, 0.62, 0.42, 0.90, w, h);
			limb(ctx, 0.50, 0.62, 0.58, 0.90, w, h);
			head(ctx, 0.50, 0.17, w, h);
		},

		// Walking — side view, mid-stride, arms counter-swinging.
		walking(ctx, w, h) {
			limb(ctx, 0.50, 0.30, 0.50, 0.60, w, h, TORSO_WIDTH);
			// Arms (one forward, one back)
			jointed(ctx, 0.50, 0.34, 0.60, 0.44, 0.66, 0.56, w, h);
			jointed(ctx, 0.50, 0.34, 0.40, 0.44, 0.34, 0.56, w, h);
			// Legs (opposite stride)
			jointed(ctx, 0.50, 0.60, 0.40, 0.74, 0.36, 0.90, w, h);
			jointed(ctx, 0.50, 0.60, 0.60, 0.74, 0.64, 0.90, w, h);
			head(ctx, 0.50, 0.17, w, h);
		},

		// Running — side view, leaning forward, knee high and arms at ~90°.
		running(ctx, w, h) {
			// Torso leans slightly forward (top shifted right)
			limb(ctx, 0.54, 0.29, 0.48, 0.60, w, h, TORSO_WIDTH);
			// Front arm bent ~90°, driving forward
			jointed(ctx, 0.54, 0.33, 0.62, 0.40, 0.62, 0.30, w, h);
			// Back arm bent ~90°, swung behind
			jointed(ctx, 0.54, 0.33, 0.43, 0.44, 0.32, 0.42, w, h);
			// Front knee driven up high, bent tight
			jointed(ctx, 0.48, 0.60, 0.36, 0.58, 0.44, 0.72, w, h);
			// Back leg trailing, slightly bent, foot pushing off
			jointed(ctx, 0.48, 0.60, 0.60, 0.76, 0.68, 0.90, w, h);
			head(ctx, 0.54, 0.17, w, h);
		},

		// Hiking — side view, one foot stepping up onto a raised rock.
		hiking(ctx, w, h) {
			limb(ctx, 0.48, 0.28, 0.48, 0.58, w, h, TORSO_WIDTH);
			// Arms in a forward-back swing (milder than running)
			jointed(ctx, 0.48, 0.32, 0.56, 0.42, 0.60, 0.52, w, h);
			jointed(ctx, 0.48, 0.32, 0.40, 0.42, 0.36, 0.52, w, h);
			// Front leg raised onto step, bent
			jointed(ctx, 0.48, 0.58, 0.40, 0.66, 0.44, 0.76, w, h);
			// Back leg straight, planted behind
			jointed(ctx, 0.48, 0.58, 0.58, 0.74, 0.62, 0.90, w, h);
			head(ctx, 0.48, 0.15, w, h);
			// Rock/step under the front foot
			const scale = Math.min(w, h);
			ctx.save();
			ctx.globalAlpha = 0.85;
			ctx.beginPath();
			ctx.moveTo(0.28 * w, 0.82 * h);
			ctx.lineTo(0.52 * w, 0.76 * h);
			ctx.lineTo(0.56 * w, 0.82 * h);
			ctx.lineTo(0.54 * w, 0.92 * h);
			ctx.lineTo(0.26 * w, 0.92 * h);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		},

		// Weightlifting — front view, overhead press with barbell.
		weightlifting(ctx, w, h) {
			// Barbell (drawn first so figure overlaps its center)
			const scale = Math.min(w, h);
			ctx.save();
			ctx.lineWidth = LIMB_WIDTH * 0.7 * scale;
			ctx.beginPath();
			ctx.moveTo(0.20 * w, 0.18 * h);
			ctx.lineTo(0.80 * w, 0.18 * h);
			ctx.stroke();
			// Plates
			ctx.beginPath();
			ctx.arc(0.20 * w, 0.18 * h, 0.07 * scale, 0, Math.PI * 2);
			ctx.arc(0.80 * w, 0.18 * h, 0.07 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
			// Torso (slight squat stance)
			limb(ctx, 0.50, 0.34, 0.50, 0.62, w, h, TORSO_WIDTH);
			// Arms overhead, bent at elbows (hands on bar)
			jointed(ctx, 0.50, 0.35, 0.40, 0.25, 0.40, 0.18, w, h);
			jointed(ctx, 0.50, 0.35, 0.60, 0.25, 0.60, 0.18, w, h);
			// Legs in slight squat
			jointed(ctx, 0.50, 0.62, 0.42, 0.76, 0.40, 0.90, w, h);
			jointed(ctx, 0.50, 0.62, 0.58, 0.76, 0.60, 0.90, w, h);
			head(ctx, 0.50, 0.20, w, h);
		},

		// HIIT — front view, jumping-jack mid-motion.
		hiit(ctx, w, h) {
			limb(ctx, 0.50, 0.32, 0.50, 0.60, w, h, TORSO_WIDTH);
			// Arms up and out
			limb(ctx, 0.50, 0.34, 0.26, 0.18, w, h);
			limb(ctx, 0.50, 0.34, 0.74, 0.18, w, h);
			// Legs splayed
			limb(ctx, 0.50, 0.60, 0.30, 0.90, w, h);
			limb(ctx, 0.50, 0.60, 0.70, 0.90, w, h);
			head(ctx, 0.50, 0.19, w, h);
		},

		// Yoga — front view, tree pose (one leg up, arms overhead).
		yoga(ctx, w, h) {
			limb(ctx, 0.50, 0.30, 0.50, 0.62, w, h, TORSO_WIDTH);
			// Both arms overhead, hands together (prayer)
			jointed(ctx, 0.50, 0.33, 0.42, 0.22, 0.48, 0.10, w, h);
			jointed(ctx, 0.50, 0.33, 0.58, 0.22, 0.52, 0.10, w, h);
			// Support leg (straight down)
			limb(ctx, 0.50, 0.62, 0.50, 0.90, w, h);
			// Raised leg — knee out to side, foot against support leg
			jointed(ctx, 0.50, 0.62, 0.68, 0.68, 0.50, 0.78, w, h);
			head(ctx, 0.50, 0.17, w, h);
		},

		// Pilates — side view, hundred position (lying on back, legs up).
		pilates(ctx, w, h) {
			// Lying body: torso horizontal
			limb(ctx, 0.20, 0.70, 0.55, 0.70, w, h, TORSO_WIDTH);
			// Head to the left
			head(ctx, 0.15, 0.70, w, h);
			// Arms raised up off the mat, pumping
			jointed(ctx, 0.50, 0.68, 0.48, 0.56, 0.50, 0.46, w, h);
			jointed(ctx, 0.52, 0.68, 0.54, 0.56, 0.56, 0.46, w, h);
			// Legs raised at 45°, knees bent
			jointed(ctx, 0.55, 0.70, 0.68, 0.56, 0.80, 0.50, w, h);
			jointed(ctx, 0.55, 0.72, 0.70, 0.60, 0.82, 0.54, w, h);
			// Mat
			const scale = Math.min(w, h);
			ctx.save();
			ctx.globalAlpha = 0.55;
			ctx.fillRect(0.08 * w, 0.80 * h, 0.78 * w, 0.04 * h);
			ctx.restore();
		},

		// Climbing — front/3-quarter view with a wall of holds behind the
		// climber. Reach up with one arm, opposite leg driven up.
		climbing(ctx, w, h) {
			// Wall holds (behind the figure)
			const scale = Math.min(w, h);
			ctx.save();
			ctx.globalAlpha = 0.55;
			const holds = [
				[0.22, 0.20], [0.74, 0.24], [0.30, 0.42], [0.68, 0.48],
				[0.20, 0.60], [0.76, 0.62], [0.35, 0.78], [0.70, 0.80],
			];
			for (const [hx, hy] of holds) {
				ctx.beginPath();
				ctx.arc(hx * w, hy * h, 0.035 * scale, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
			// Torso
			limb(ctx, 0.48, 0.32, 0.50, 0.60, w, h, TORSO_WIDTH);
			// Up-reaching arm (right, going to a high hold)
			jointed(ctx, 0.48, 0.34, 0.60, 0.22, 0.64, 0.12, w, h);
			// Other arm bent, hand near chest
			jointed(ctx, 0.48, 0.34, 0.38, 0.40, 0.44, 0.48, w, h);
			// Up-driven leg (mirror of the reaching arm — left leg high + out)
			jointed(ctx, 0.50, 0.60, 0.32, 0.62, 0.28, 0.76, w, h);
			// Support leg planted below
			jointed(ctx, 0.50, 0.60, 0.58, 0.76, 0.58, 0.90, w, h);
			head(ctx, 0.48, 0.19, w, h);
		},
	};

	global.drawWorkoutFigure = drawWorkoutFigure;
	global.WORKOUT_POSE_NAMES = Object.keys(POSE_DRAWERS);
})(typeof window !== 'undefined' ? window : globalThis);
