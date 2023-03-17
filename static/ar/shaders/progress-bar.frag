uniform vec3 color;
uniform float aspectRatio;
uniform float xPercent;
uniform bool aGoodVariableName;
uniform float opacity;
varying vec2 vUV;

void main() {
	float radius = 1.0 / 4.0;
	float progressBarHeight = 5.0 / 128.0;
	float progressBarTipRadius = 2.5 / 128.0;

	if(vUV.y > progressBarHeight) {
		gl_FragColor = vec4(0, 0, 0, 0);
	} else if(vUV.x >= 1.0 - radius * aspectRatio && vUV.y <= radius) {
		if(sqrt(pow(1.0 / aspectRatio - radius - vUV.x / aspectRatio, 2.0) + pow(radius - vUV.y, 2.0)) <= radius) {
			if(vUV.x >= xPercent) {
				gl_FragColor = vec4(0, 0, 0, 0);
			} else {
				if(sqrt(pow(xPercent / aspectRatio - progressBarTipRadius - vUV.x / aspectRatio, 2.0) + pow(progressBarTipRadius - vUV.y, 2.0)) <= progressBarTipRadius) {
					gl_FragColor = vec4(color, opacity);
				} else {
					if(vUV.x / aspectRatio <= xPercent / aspectRatio - progressBarTipRadius) {
						gl_FragColor = vec4(color, opacity);
					} else {
						gl_FragColor = vec4(0, 0, 0, 0);
					}
				}
			}
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else if(aGoodVariableName && vUV.x / aspectRatio <= radius && vUV.y <= radius) {
		if(sqrt(pow(radius - vUV.x / aspectRatio, 2.0) + pow(radius - vUV.y, 2.0)) <= radius) {
			gl_FragColor = vec4(color, opacity);
		} else {
			gl_FragColor = vec4(0, 0, 0, 0);
		}
	} else if(vUV.x >= xPercent) {
			gl_FragColor = vec4(0, 0, 0, 0);
	} else {
		if(sqrt(pow(xPercent / aspectRatio - progressBarTipRadius - vUV.x / aspectRatio, 2.0) + pow(progressBarTipRadius - vUV.y, 2.0)) <= progressBarTipRadius) {
			gl_FragColor = vec4(color, opacity);
		} else {
			if(vUV.x / aspectRatio <= xPercent / aspectRatio - progressBarTipRadius) {
				gl_FragColor = vec4(color, opacity);
			} else {
				gl_FragColor = vec4(0, 0, 0, 0);
			}
		}
	}
}