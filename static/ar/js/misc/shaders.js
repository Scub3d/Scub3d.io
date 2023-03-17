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