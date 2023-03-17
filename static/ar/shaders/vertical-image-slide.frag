uniform sampler2D src;
uniform float yOffset;
uniform float lowerBound;
uniform float upperBound;
uniform float multiplier;
uniform float aspectRatio;
varying vec2 vUV;

void main() {
	float radius = 1.0 / 4.0 * multiplier;
	
	if(vUV.x / aspectRatio <= radius && vUV.y >= lowerBound && vUV.y <= lowerBound + radius) {
		if(sqrt(pow(radius - vUV.x / aspectRatio, 2.0) + pow(lowerBound + radius - vUV.y, 2.0)) <= radius) {
			gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y + yOffset)).xyz, 1);
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else if(vUV.x / aspectRatio <= radius && vUV.y >= upperBound - radius && vUV.y <= upperBound) {
		if(sqrt(pow(radius - vUV.x / aspectRatio, 2.0) + pow(upperBound - radius - vUV.y, 2.0)) <= radius) {
			gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y + yOffset)).xyz, 1);
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else if(vUV.x >= 1.0 - radius * aspectRatio && vUV.y >= lowerBound && vUV.y <= lowerBound + radius) {
		if(sqrt(pow(1.0 / aspectRatio - radius - vUV.x / aspectRatio, 2.0) + pow(lowerBound + radius - vUV.y, 2.0)) <= radius) {
			gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y + yOffset)).xyz, 1);
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else if(vUV.x >= 1.0 - radius * aspectRatio && vUV.y >= upperBound - radius && vUV.y <= upperBound) {
		if(sqrt(pow(1.0 / aspectRatio - radius - vUV.x / aspectRatio, 2.0) + pow(upperBound - radius - vUV.y, 2.0)) <= radius) {
			gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y + yOffset)).xyz, 1);
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else if(vUV.y >= upperBound || vUV.y <= lowerBound) {
		gl_FragColor = vec4(0, 0, 0, 0);
	} else  {
		gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y + yOffset)).xyz, 1);
	}
}