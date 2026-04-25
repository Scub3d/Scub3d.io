// Animated Instagram-brand border. Draws only the outline of a rounded
// rectangle; the color at each point along the outline is sampled from
// the 4-stop brand palette keyed on (angle around center + time).
//
// Uniforms:
//   time          — seconds-ish counter, ticked by a JS component
//   aspectRatio   — face height / face width (128/512 = 0.25 for 4:1)
//   cornerRadius  — in aspect-normalized units (~0.08 = matches SVG)
//   borderWidth   — thickness of the outline band (~0.03)

uniform float time;
uniform float aspectRatio;
uniform float cornerRadius;
uniform float borderWidth;
varying vec2 vUV;

#define PI 3.14159265359

// Instagram brand stops traversed as a 6-segment pingpong so the cycle
// closes on the same color it started with (yellow). Without the pingpong,
// the direct blue → yellow wrap is a large RGB jump that reads as a
// visible snap after one full revolution.
//   yellow → orange → magenta → blue → magenta → orange → (wrap yellow)
vec3 palette(float t) {
	t = fract(t) * 6.0;
	vec3 c0 = vec3(1.000, 0.867, 0.333); // #fd5    yellow
	vec3 c1 = vec3(1.000, 0.329, 0.243); // #ff543e orange-red
	vec3 c2 = vec3(0.784, 0.216, 0.671); // #c837ab magenta
	vec3 c3 = vec3(0.216, 0.443, 0.784); // #3771c8 blue
	if (t < 1.0) return mix(c0, c1, t);
	if (t < 2.0) return mix(c1, c2, t - 1.0);
	if (t < 3.0) return mix(c2, c3, t - 2.0);
	if (t < 4.0) return mix(c3, c2, t - 3.0);
	if (t < 5.0) return mix(c2, c1, t - 4.0);
	return mix(c1, c0, t - 5.0);
}

// Signed distance from point `p` to the outline of a rounded rectangle
// centered at origin with half-extents `halfSize` and corner radius `r`.
// <0 inside, >0 outside, 0 on the outline. We treat |sdf| < borderWidth/2
// as "on the border".
float sdRoundedRect(vec2 p, vec2 halfSize, float r) {
	vec2 d = abs(p) - halfSize + r;
	return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

void main() {
	// Stretch x into aspect-normalized coords so rounded corners read as
	// true circles instead of stretched ellipses.
	float aw = 1.0 / aspectRatio;
	vec2 p = vec2(vUV.x * aw - aw * 0.5, vUV.y - 0.5);

	// Independent SDFs for the OUTER and INNER edges of the border band.
	// A single SDF + band would force innerRadius = cornerRadius -
	// borderWidth/2 — which goes visibly sharp on wider bands. Giving
	// each edge its own radius lets both corners read as equally round.
	float aa = 0.008;
	vec2 outerHalfSize = vec2(aw * 0.5 - aa, 0.5 - aa);
	vec2 innerHalfSize = outerHalfSize - vec2(borderWidth, borderWidth);
	float innerRadius = cornerRadius * 0.72; // slightly tighter, visually matched

	float dOuter = sdRoundedRect(p, outerHalfSize, cornerRadius);
	float dInner = sdRoundedRect(p, innerHalfSize, innerRadius);

	// Fragment is in the band when it's inside the outer shape AND
	// outside the inner shape. smoothstep each edge for anti-aliasing.
	float outerMask = 1.0 - smoothstep(0.0, aa, dOuter);
	float innerMask = smoothstep(0.0, aa, dInner);
	float borderMask = outerMask * innerMask;
	if (borderMask <= 0.001) discard;

	// Color by angle from center + time offset. Angle compression at
	// corners of a long rectangle gives a subtle "flowing" effect —
	// the palette appears to chase around the border continuously.
	float angle = atan(p.y, p.x);
	float t = (angle / (2.0 * PI)) + time * 0.10;
	gl_FragColor = vec4(palette(t), borderMask);
}
