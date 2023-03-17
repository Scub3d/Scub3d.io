uniform vec3 color;
uniform float multiplier;
uniform float aspectRatio;
varying vec2 vUV;

void main() {
	float radius = 1.0 / 4.0 * multiplier;
	
	if(vUV.x >= 1.0 - radius * aspectRatio && vUV.y <= radius) {
		if(sqrt(pow(1.0 / aspectRatio - radius - vUV.x / aspectRatio, 2.0) + pow(radius - vUV.y, 2.0)) <= radius) {
			gl_FragColor = vec4(color, 1);
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else if(vUV.x >= 1.0 - radius * aspectRatio && vUV.y >= 1.0 - radius) {
		if(sqrt(pow(1.0 / aspectRatio - radius - vUV.x / aspectRatio, 2.0) + pow(1.0 - radius - vUV.y, 2.0)) <= radius) {
			gl_FragColor = vec4(color, 1);
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else  {
		gl_FragColor = vec4(color, 1);
	}
}