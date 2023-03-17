uniform sampler2D src;
uniform float multiplier;
uniform float aspectRatio;
uniform float opacity;
varying vec2 vUV;

void main() {
	float radius = 1.0 / 4.0 * multiplier;
	
	if(vUV.x >= 1.0 - radius * aspectRatio && vUV.y <= radius) {
		if(sqrt(pow(1.0 / aspectRatio - radius - vUV.x / aspectRatio, 2.0) + pow(radius - vUV.y, 2.0)) <= radius) {
			gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y)).xyz, opacity);
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else if(vUV.x >= 1.0 - radius * aspectRatio && vUV.y >= 1.0 - radius) {
		if(sqrt(pow(1.0 / aspectRatio - radius - vUV.x / aspectRatio, 2.0) + pow(1.0 - radius - vUV.y, 2.0)) <= radius) {
			gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y)).xyz, opacity);
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else  {
		gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y)).xyz, opacity);
	}
}