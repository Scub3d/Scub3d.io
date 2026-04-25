// Flat map with a generalized-location indicator baked in: same rounded-
// corner clipping as image-rounded-corners, plus a uniform translucent blue
// fill inside a core radius and a thin white ring at that boundary —
// Apple's approximate-location aesthetic. Blending happens inside the
// shader so there's no alpha-sort layering between separate primitives.
AFRAME.registerShader('image-with-location', {
	schema: {
		src: { type: 'map', is: 'uniform' },
		multiplier: { type: 'number', is: 'uniform', default: 1.0 },
		aspectRatio: { type: 'number', is: 'uniform', default: 1.0 },
	},

	vertexShader: [
		'varying vec2 vUV;',
		'void main(void) {',
		'	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
		'	vUV = uv;',
		'}'
	].join('\n'),

	fragmentShader: [
		'uniform sampler2D src;',
		'uniform float multiplier;',
		'uniform float aspectRatio;',
		'varying vec2 vUV;',
		'void main() {',
		'	float cornerRadius = 1.0 / 4.0 * multiplier;',
		// Rounded-corner clip (same shape as image-rounded-corners.frag).
		'	if(vUV.x / aspectRatio <= cornerRadius && vUV.y <= cornerRadius) {',
		'		if(sqrt(pow(cornerRadius - vUV.x / aspectRatio, 2.0) + pow(cornerRadius - vUV.y, 2.0)) > cornerRadius) { gl_FragColor = vec4(0, 0, 0, 0); return; }',
		'	} else if(vUV.x / aspectRatio <= cornerRadius && vUV.y >= 1.0 - cornerRadius) {',
		'		if(sqrt(pow(cornerRadius - vUV.x / aspectRatio, 2.0) + pow(1.0 - cornerRadius - vUV.y, 2.0)) > cornerRadius) { gl_FragColor = vec4(0, 0, 0, 0); return; }',
		'	} else if(vUV.x >= 1.0 - cornerRadius * aspectRatio && vUV.y <= cornerRadius) {',
		'		if(sqrt(pow(1.0 / aspectRatio - cornerRadius - vUV.x / aspectRatio, 2.0) + pow(cornerRadius - vUV.y, 2.0)) > cornerRadius) { gl_FragColor = vec4(0, 0, 0, 0); return; }',
		'	} else if(vUV.x >= 1.0 - cornerRadius * aspectRatio && vUV.y >= 1.0 - cornerRadius) {',
		'		if(sqrt(pow(1.0 / aspectRatio - cornerRadius - vUV.x / aspectRatio, 2.0) + pow(1.0 - cornerRadius - vUV.y, 2.0)) > cornerRadius) { gl_FragColor = vec4(0, 0, 0, 0); return; }',
		'	}',
		// Sample base map.
		'	vec3 baseColor = texture2D(src, vUV).xyz;',
		// Circular indicator centered on the image — user\'s rough lat/lon.
		// Work in source pixel space (512x128) so the circle stays round
		// regardless of the plane\'s displayed aspect.
		'	vec2 pixelOffset = vec2((vUV.x - 0.5) * 512.0, (vUV.y - 0.5) * 128.0);',
		'	float distPx = length(pixelOffset);',
		'	float coreRadius = 40.0;',
		'	vec3 locColor = vec3(0.259, 0.522, 0.957);',
		// Uniform translucent blue inside coreRadius (mix factor = opacity).
		'	float fillMask = 1.0 - smoothstep(coreRadius - 0.5, coreRadius + 0.5, distPx);',
		// Thin anti-aliased white ring at the boundary.
		'	float ringDist = abs(distPx - coreRadius);',
		'	float ringMask = 1.0 - smoothstep(0.5, 2.0, ringDist);',
		'	vec3 color = baseColor;',
		'	color = mix(color, locColor, fillMask * 0.45);',
		'	color = mix(color, vec3(1.0), ringMask * 0.9);',
		'	gl_FragColor = vec4(color, 1.0);',
		'}'
	].join('\n')
});

AFRAME.registerShader('crop-text', {
	schema: {
		src: { type: 'map', is: 'uniform' },
		xOffset: { type: 'number', is: 'uniform', default: 0.0 },
		percent: { type: 'number', is: 'uniform', default: 1.0 },
		opacity: { type: 'number', is: 'uniform', default: 1.0 },
	},
	
	vertexShader: [
		'varying vec2 vUV;',
		'void main(void) {',
		'	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
		'	vUV = uv;',
		'}'
	].join('\n'),

	fragmentShader: [
		'uniform sampler2D src;',
		'uniform float xOffset;',
		'uniform float percent;',
		'uniform float opacity;',
		'varying vec2 vUV;',
		'void main() {',
		'   if(vUV.x >= percent)',
		'       gl_FragColor = vec4(0, 0, 0, 0);',
		'   else',
		'       gl_FragColor = vec4(texture2D(src, vec2(vUV.x + xOffset, vUV.y)).xyz, opacity * texture2D(src, vec2(vUV.x + xOffset, vUV.y)).a);',
		'}'
	].join('\n')
});

async function loadShader(shaderName, schema) {
	var loader = new THREE.FileLoader();
	var fragmentShader, vertexShader;
	var filesToLoad = 2;

	loader.load('https://static.scub3d.io/ar/shaders/' + shaderName + '.frag', function (data) { fragmentShader = data; checkIfCanRegisterShader(); });
	loader.load('https://static.scub3d.io/ar/shaders/main.vert', function (data) { vertexShader = data; checkIfCanRegisterShader(); });

	function checkIfCanRegisterShader() {
		filesToLoad--;

		if(filesToLoad === 0) {
			registerShader();
		}
	}

	function registerShader() {
		AFRAME.registerShader(shaderName, {
			schema: schema,
			vertexShader: vertexShader.trim(),
			fragmentShader: fragmentShader.trim()
		});
	}
}

loadShader('vertical-image-slide', { src: { type: 'map', is: 'uniform' }, yOffset: { type: 'number', is: 'uniform', default: 0.0 },	lowerBound: { type: 'number', is: 'uniform', default: 1.0 }, upperBound: { type: 'number', is: 'uniform', default: 1.0 }, multiplier: { type: 'number', is: 'uniform', default: 1.0 }, aspectRatio: { type: 'number', is: 'uniform', default: 1.0 }	});
loadShader('image-rounded-corners', { src: { type: 'map', is: 'uniform' }, multiplier: { type: 'number', is: 'uniform', default: 1.0 }, aspectRatio: { type: 'number', is: 'uniform', default: 1.0 }, opacity: {type: 'number', is: 'uniform', default: 1.0 } });
loadShader('left-sided-rounded-corners', { src: { type: 'map', is: 'uniform' }, multiplier: { type: 'number', is: 'uniform', default: 1.0 }, aspectRatio: { type: 'number', is: 'uniform', default: 1.0 }, opacity: {type: 'number', is: 'uniform', default: 1.0 } });
loadShader('right-sided-rounded-corners', { src: { type: 'map', is: 'uniform' }, multiplier: { type: 'number', is: 'uniform', default: 1.0 }, aspectRatio: { type: 'number', is: 'uniform', default: 1.0 }, opacity: {type: 'number', is: 'uniform', default: 1.0 } });
loadShader('right-sided-color-rounded-corners', { color: { type: 'vec3', is: 'uniform' }, multiplier: { type: 'number', is: 'uniform', default: 1.0 }, aspectRatio: { type: 'number', is: 'uniform', default: 1.0 } });
loadShader('progress-bar', { color: { type: 'vec3', is: 'uniform' }, xPercent: { type: 'number', is: 'uniform', default: 1.0 }, aspectRatio: { type: 'number', is: 'uniform', default: 1.0 }, aGoodVariableName: { type: 'bool', is: 'uniform', default: false }, opacity: {type: 'number', is: 'uniform', default: 1.0 } });
loadShader('color-rounded-corners', { color: { type: 'vec3', is: 'uniform' }, multiplier: { type: 'number', is: 'uniform', default: 1.0 }, aspectRatio: { type: 'number', is: 'uniform', default: 1.0 } });
loadShader('instagram-animated-border', { time: { type: 'number', is: 'uniform', default: 0.0 }, aspectRatio: { type: 'number', is: 'uniform', default: 0.25 }, cornerRadius: { type: 'number', is: 'uniform', default: 0.25 }, borderWidth: { type: 'number', is: 'uniform', default: 0.084 } });