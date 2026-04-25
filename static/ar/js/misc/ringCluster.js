// Three concentric progress rings, rendered on a single 2D canvas and
// wrapped in a CanvasTexture on a plane. Apple's watchOS rings are
// visually flat anyway — 3D torus geometry kept fighting THREE's depth
// sort at oblique AR angles, and the 2D approach is both simpler and
// visually identical for this widget.
//
// Public API: `new RingCluster()` returns `{ group, setProgress(cluster) }`,
// drop-in compatible with the prior 3D implementation.

(function (global) {
	'use strict';

	// Per-slot colors (match the visual vocabulary of Apple-rings without
	// being pixel-identical hues).
	const RING_COLORS = {
		move:      0xff2a52, // energy / Move analog
		exercise:  0x46e85a, // minutes / Exercise analog
		stand:     0x2ac8e0, // stand hours / Stand analog
	};
	// Rail (unfilled track) is an opaque darker shade of the same hue.
	const RAIL_DARKEN_FACTOR = 0.22;
	// Relative radii of the three rings, as fractions of half the canvas
	// width. Outer ring largest; inner rings step in by RING_SPACING.
	const OUTER_RING_FRACTION = 0.85;
	const RING_SPACING_FRACTION = 0.20;
	// Stroke widths, also as fractions of the canvas width. Rail is thinner
	// than the foreground so the filled-arc silhouette dominates where it's
	// present and the rail peeks through only in the unfilled remainder.
	const FOREGROUND_STROKE_FRACTION = 0.082;
	const RAIL_STROKE_FRACTION = 0.052;
	// Foreground's tail fades to the SAME color as the rail — that way the
	// seam between "end of the colored arc" and "start of the unfilled
	// rail" is invisible rather than a visible jump. Both use the same
	// RAIL_DARKEN_FACTOR below.
	// Canvas pixel size. 512 gives crisp rendering at typical AR viewing
	// distances; disable mipmaps + linear filter keeps the edges sharp.
	const CANVAS_SIZE = 512;

	function darkenHex(hex, factor) {
		const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 0xff) * factor)));
		const g = Math.max(0, Math.min(255, Math.round(((hex >>  8) & 0xff) * factor)));
		const b = Math.max(0, Math.min(255, Math.round(((hex      ) & 0xff) * factor)));
		return (r << 16) | (g << 8) | b;
	}
	function toHexString(hex) {
		return '#' + hex.toString(16).padStart(6, '0');
	}

	class RingCluster {
		constructor() {
			this.canvas = document.createElement('canvas');
			this.canvas.width = CANVAS_SIZE;
			this.canvas.height = CANVAS_SIZE;
			this.ctx = this.canvas.getContext('2d');

			this.texture = new THREE.CanvasTexture(this.canvas);
			this.texture.generateMipmaps = false;
			this.texture.minFilter = THREE.LinearFilter;
			this.texture.magFilter = THREE.LinearFilter;

			const material = new THREE.MeshBasicMaterial({
				map: this.texture,
				transparent: true,
			});
			// PlaneGeometry(1, 1) — the widget applies a (S, 4S, S) scale
			// to the cluster group to counter its own 4:1 horizontal squish,
			// so a square canvas lands on a square rendered area.
			this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
			this.group = new THREE.Object3D();
			this.group.add(this.plane);

			// Pre-render at 0% so the cluster's texture has valid pixels
			// from first frame even before setProgress is called.
			this._render(null);
		}

		setProgress(cluster) {
			this._render(cluster);
			this.texture.needsUpdate = true;
		}

		_render(cluster) {
			const ctx = this.ctx;
			const size = CANVAS_SIZE;
			const cx = size / 2, cy = size / 2;
			ctx.clearRect(0, 0, size, size);
			ctx.lineCap = 'round';

			const rings = [
				{ key: 'move',     radiusFraction: OUTER_RING_FRACTION },
				{ key: 'exercise', radiusFraction: OUTER_RING_FRACTION - RING_SPACING_FRACTION },
				{ key: 'stand',    radiusFraction: OUTER_RING_FRACTION - 2 * RING_SPACING_FRACTION },
			];
			// Leave half the stroke width of padding inside the canvas edge
			// so rounded line caps don't clip at the edge.
			const strokePad = size * FOREGROUND_STROKE_FRACTION * 0.5;
			const baseRadius = size / 2 - strokePad;
			const fgStroke = size * FOREGROUND_STROKE_FRACTION;
			const railStroke = size * RAIL_STROKE_FRACTION;

			for (const ring of rings) {
				const color = RING_COLORS[ring.key];
				const radius = baseRadius * ring.radiusFraction;

				// Rail — full circle, darker shade of the same hue.
				ctx.strokeStyle = toHexString(darkenHex(color, RAIL_DARKEN_FACTOR));
				ctx.lineWidth = railStroke;
				ctx.beginPath();
				ctx.arc(cx, cy, radius, 0, Math.PI * 2);
				ctx.stroke();

				// Foreground arc — partial, bright. Canvas angles are CW+
				// from +X; -π/2 is 12 o'clock. Sweep by 2π · fraction for
				// a clockwise fill.
				const entry = cluster && cluster[ring.key];
				if (!entry || !entry.goal) continue;
				const rawFraction = entry.progress / entry.goal;
				if (!isFinite(rawFraction) || rawFraction <= 0) continue;
				// Cap at a single loop for v1. A second "overflow" pass could
				// be layered in later (brighter stroke over the full ring) if
				// we want to visualize >100% separately.
				const fraction = Math.min(1, rawFraction);
				const startAngle = -Math.PI / 2;
				const endAngle = startAngle + 2 * Math.PI * fraction;

				// Conic gradient from tail (start of arc) to head (end of
				// arc, full brightness). Tail color matches the rail's
				// exactly, so the transition from "filled" to "unfilled"
				// is seamless. Head color lands precisely at the arc end
				// rather than at the full-loop point.
				const grad = ctx.createConicGradient(startAngle, cx, cy);
				grad.addColorStop(0, toHexString(darkenHex(color, RAIL_DARKEN_FACTOR)));
				grad.addColorStop(Math.max(0.001, fraction), toHexString(color));
				grad.addColorStop(1, toHexString(color));

				ctx.strokeStyle = grad;
				ctx.lineWidth = fgStroke;
				ctx.beginPath();
				ctx.arc(cx, cy, radius, startAngle, endAngle, false);
				ctx.stroke();
			}
		}
	}

	global.RingCluster = RingCluster;
	global.RING_CLUSTER_COLORS = RING_COLORS;
})(typeof window !== 'undefined' ? window : globalThis);
