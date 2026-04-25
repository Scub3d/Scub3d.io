function setMatOpacity(selector, value) {
	const el = document.querySelector(selector);
	if (el && el.setAttribute) el.setAttribute('material', 'opacity', value);
}

function setVisible(selector, value) {
	const el = document.querySelector(selector);
	if (el && el.setAttribute) el.setAttribute('visible', value);
}

// Drives the xPercent uniform on the progress-bar shader so the bar marches
// forward in real time between data polls. creationTime is stamped at init,
// then each tick we derive the current progress from startProgressMS + real
// elapsed. Component dies with its entity (widget rebuild on track change),
// which naturally resets the clock.
AFRAME.registerComponent('progress-bar-animator', {
	schema: {
		startProgressMS: { type: 'number', default: 0 },
		durationMS: { type: 'number', default: 1 }
	},
	init: function() {
		this.creationTime = Date.now();
		// Throttle to 10Hz. Progress bars move pixel-fractions per frame at
		// 60Hz — wasteful. 100ms updates are indistinguishable to the eye
		// on a bar of this size.
		this.tick = AFRAME.utils.throttleTick(this.tick, 100, this);
	},
	update: function() {
		// If a caller updates the schema values (e.g. on trackProgressMS
		// resync from a poll), reset the clock so the new baseline is honored.
		this.creationTime = Date.now();
	},
	tick: function() {
		const mesh = this.el.getObject3D('mesh');
		if (!mesh || !mesh.material || !mesh.material.uniforms) return;
		const uniform = mesh.material.uniforms.xPercent;
		if (!uniform) return;
		const elapsed = Date.now() - this.creationTime;
		const currentMs = this.data.startProgressMS + elapsed;
		const duration = this.data.durationMS || 1;
		uniform.value = Math.min(1, Math.max(0, currentMs / duration));
	}
});

// Pushes a monotonically-increasing `time` uniform onto the mesh's shader
// material every frame. Used by any shader that wants time-based motion
// (e.g. the instagram-animated-border gradient sweep).
AFRAME.registerComponent('shader-time-ticker', {
	init: function() {
		this.startTime = performance.now();
	},
	tick: function() {
		const mesh = this.el.getObject3D('mesh');
		if (!mesh || !mesh.material || !mesh.material.uniforms) return;
		const uniform = mesh.material.uniforms.time;
		if (!uniform) return;
		uniform.value = (performance.now() - this.startTime) / 1000;
	}
});

AFRAME.registerComponent('mask', {
	init: function() {
	// make sure the model is loaded first
		this.el.addEventListener('model-loaded', e=> {
			let mesh = this.el.getObject3D('mesh') // grab the mesh
			if (mesh === undefined) return;        // return if no mesh :(
			mesh.traverse(function(node) {         // traverse through and apply settings
				if (node.isMesh && node.material) {  // make sure the element can be a cloak
					node.material.colorWrite = false
					node.material.needsUpdate = true;
				}
			});
		})
	}
});

AFRAME.registerComponent('model-color', {
	schema: { type: 'color', default: '#ffffff' },
	init: function() {
		this.el.addEventListener('model-loaded', () => {
			const mesh = this.el.getObject3D('mesh');
			if (!mesh) return;

			const color = new THREE.Color(this.data);
			mesh.traverse(node => {
				if (!node.isMesh || !node.material) return;
				const mats = Array.isArray(node.material) ? node.material : [node.material];
				mats.forEach(m => {
					if (m.color) m.color.copy(color);
					m.needsUpdate = true;
				});
			});
		});
	}
});

AFRAME.registerComponent('text-background', {
	schema: {
		color: { type: 'color', default: '#000000' },
		opacity: { type: 'number', default: 0.65 },
		paddingX: { type: 'number', default: 0.25 },
		paddingY: { type: 'number', default: 0.2 },
		zOffset: { type: 'number', default: 0.001 }
	},
	init: function() {
		this.bg = document.createElement('a-plane');
		this.bg.setAttribute('material', {
			color: this.data.color,
			opacity: this.data.opacity,
			transparent: true,
			side: 'double',
			depthWrite: false
		});
		this.el.appendChild(this.bg);

		this.el.addEventListener('textfontset', () => this.resize());
	},
	resize: function() {
		const textMesh = this.el.getObject3D('text');
		if (!textMesh || !textMesh.geometry) return;
		textMesh.geometry.computeBoundingBox();
		if (!textMesh.geometry.boundingBox) return;

		// Transform the geometry-local bounding box into entity-local coords
		// via the mesh's full matrix (scale + anchor/baseline offset). Doing
		// this by hand drops the anchor offset and lands the bg at a corner
		// instead of the center.
		const box = textMesh.geometry.boundingBox.clone();
		textMesh.updateMatrix();
		box.applyMatrix4(textMesh.matrix);

		const size = new THREE.Vector3();
		const center = new THREE.Vector3();
		box.getSize(size);
		box.getCenter(center);

		const padX = size.y * this.data.paddingX;
		const padY = size.y * this.data.paddingY;

		this.bg.setAttribute('width', size.x + padX * 2);
		this.bg.setAttribute('height', size.y + padY * 2);
		this.bg.setAttribute('position', center.x + ' ' + center.y + ' ' + (center.z + this.data.zOffset));
	}
});

AFRAME.registerComponent('anti-tear', { // I forgot what this does but it breaks if I remove it
	init: function(){
		let el = this.el;
		let self = this;

		el.addEventListener('materialtextureloaded', function(ev) {
			setTimeout(function () {
				el.sceneEl.renderer.sortObjects = true;
				el.object3D.renderOrder = 100;
				el.components.material.material.depthTest = false;
			}, 200);
		});
	},
});


AFRAME.registerComponent('slide-text', {
	schema: {
		percent: { type: 'number', default: 1 },
		xOffset: { type: 'number', default: 0 },
		stopLimit: { type: 'number', default: 0.5 },
		direction: { type: 'number', default: 1 }
	},
	init: function() {
		this.stopOffset = this.data.stopLimit;
		this.lock = false;
		this.lockStartTime = null;

		this.xOffset = this.data.xOffset;
		this.direction = this.data.direction;
		this.speed = (1 - this.data.percent) / 4000;
	},
	_tryBindMaterial: function() {
		const mesh = this.el.getObject3D('mesh');
		if (!mesh || !mesh.material || !mesh.material.uniforms || !mesh.material.uniforms.percent) return false;
		this.material = mesh.material;
		this.material.uniforms.percent.value = this.data.percent;
		this.material.uniforms.xOffset.value = this.xOffset;
		return true;
	},
	tick: function() {
		if (this.material === undefined) {
			if (!this._tryBindMaterial()) return;
		}
		if (this.xOffset === undefined) return;

		if(this.xOffset > this.stopOffset) {
			this.material.uniforms.xOffset.value = 0;
			this.xOffset = 0;
			this.lock = true;
			this.lockStartTime = Date.now();
		}

		if(!this.lock) {
			this.xOffset += (this.speed * this.direction);
			this.material.uniforms.xOffset.value = this.xOffset;
		} else {
			if(Date.now() - this.lockStartTime > 10000) {
				this.material.uniforms.xOffset.value = 0;
				this.xOffset = 0;
				this.lock = false;
			}
		}
	},
});

AFRAME.registerComponent('alternator', {
	schema: {
		imageOneURL: { type: 'string', default: '' },
		imageTwoURL: { type: 'string', default: '' },
	},
	init: function() {
		this.fadeInSignal = 'fade-in';
		this.fadeOutSignal = 'fade-out';

		this.textureOne = new THREE.TextureLoader().load( this.data['imageOneURL'] );
		this.textureTwo = new THREE.TextureLoader().load( this.data['imageTwoURL'] );

		this.images = [this.textureOne, this.textureTwo];
		this.imageIndex = 1;

		this.el.addEventListener('animationcomplete__fadein', (e) => {
			this.lock = true;
			this.lockStartTime = Date.now();
		});

		this.el.addEventListener('animationcomplete__fadeout', (e) => {
			this.el.setAttribute("material", "src", this.images[this.imageIndex]);
			this.imageIndex = this.imageIndex === 1 ? 0 : 1;
			this.el.emit(this.fadeInSignal);
		});

		this.lock = true;
		this.lockStartTime = Date.now();
	},
	tick: function() {
		if(this.lock) {
			if(Date.now() - this.lockStartTime > 10000) {
				this.lock = false;
				this.el.emit(this.fadeOutSignal);
			}
		}
	},
});

AFRAME.registerComponent('instagram-image-switcher', {
	schema: {
		images: { type: 'array', default: [] },
	},
	init: function() {
		this.switchImageSignal = 'switchImage';

		this.images = this.data.images;
		this.imageIndex = 1;

		let el = this.el;
		let self = this;

		$('#' + this.el.id).on(this.switchImageSignal, function(e) {
			el.setAttribute("material", "src", self.images[self.imageIndex]);
			self.imageIndex = (self.imageIndex + 1) % self.images.length;
		});
	},
	tick: function() {}
});

AFRAME.registerComponent('instagram-alternate-entities', {
	schema: {
		entityIDs: { type: 'array', default: [] },
		numberOfEntities: { type: 'number', default: 2 },
	},
	init: function() {
		this.switchImageSignal = 'switchImage';
		this.entityIndex = 0;
		this.childList = [];

		for(var entityIDIndex = 0; entityIDIndex < this.data.entityIDs.length; entityIDIndex++) {
			$(this.data.entityIDs[entityIDIndex]).find('a-image').each((index, child) => {
				if(this.childList[entityIDIndex] === undefined) {
					this.childList[entityIDIndex] = [];
				}
				this.childList[entityIDIndex].push(child.id);
			});
			
			if(this.entityIndex === entityIDIndex) continue;

			setMatOpacity(this.data.entityIDs[entityIDIndex], 0);
			setVisible(this.data.entityIDs[entityIDIndex], false);

			if(this.childList[entityIDIndex] === undefined) continue;

			this.childList[entityIDIndex].forEach((childID) => {
				setMatOpacity('#' + childID, 0);
				setVisible('#' + childID, false);
			});
		}

		this.cycleStartTime = Date.now();
		this.transitioning = false;
		this.transitionStartTime = Date.now();
	},
	tick: function() {
		if(this.transitioning) {
			const timeElapsed = Date.now() - this.transitionStartTime;
			var hasHiddenEntity = false;
			var hasRevealedEntity = false;
			var hasUnhiddenEntity = false;

			const currentID = this.data.entityIDs[this.entityIndex];
			const nextID = this.data.entityIDs[(this.entityIndex + 1) % this.data.numberOfEntities];
			const currentChildren = this.childList[this.entityIndex];
			const nextChildren = this.childList[(this.entityIndex + 1) % this.data.numberOfEntities];

			if(timeElapsed <= 1000) {
				const fadeOut = 1 - timeElapsed / 1000;
				setMatOpacity(currentID, fadeOut);

				if(currentChildren === undefined) return;

				currentChildren.forEach((childID) => setMatOpacity('#' + childID, fadeOut));
			} else if(timeElapsed <= 2000) {
				if(!hasHiddenEntity) {
					setMatOpacity(currentID, 0);
					setVisible(currentID, false);

					if(currentChildren === undefined) return;

					currentChildren.forEach((childID) => {
						setMatOpacity('#' + childID, 0);
						setVisible('#' + childID, false);
					});

					hasHiddenEntity = true;
				}

				if(!hasUnhiddenEntity) {
					setVisible(nextID, true);

					nextChildren.forEach((childID) => setVisible('#' + childID, true));

					hasUnhiddenEntity = true;
				}

				const fadeIn = (timeElapsed - 1000) / 1000;
				setMatOpacity(nextID, fadeIn);

				if(nextChildren === undefined) return;

				nextChildren.forEach((childID) => setMatOpacity('#' + childID, fadeIn));
			} else if(timeElapsed > 2000) {
				if(!hasRevealedEntity) {
					setMatOpacity(nextID, 1);

					if(nextChildren === undefined) return;

					nextChildren.forEach((childID) => setMatOpacity('#' + childID, 1));

					if(this.entityIndex === 1) {
						currentChildren.forEach((childID) => {
							$('#' + childID).trigger(this.switchImageSignal);
						});
					}

					hasRevealedEntity = true;
				}

				this.transitioning = false;
				this.cycleStartTime = Date.now();
				this.entityIndex = (this.entityIndex + 1) % this.data.numberOfEntities;
			}
		} else if(Date.now() - this.cycleStartTime > 10000){
			this.transitioning = true;
			this.transitionStartTime = Date.now();
		}
	},
});

AFRAME.registerComponent('alternate-entities', {
	schema: {
		entityIDs: { type: 'array', default: [] },
		numberOfEntities: { type: 'number', default: 2 },
	},
	init: function() {
		this.fadeInSignal = 'fade-in';
		this.fadeOutSignal = 'fade-out';

		this.entityIndex = 0;

		this.childList = [];

		this.childColliderPlanes = [];

		for(var entityIDIndex = 0; entityIDIndex < this.data.entityIDs.length; entityIDIndex++) {
			$(this.data.entityIDs[entityIDIndex]).find('a-entity').each((index, child) => {
				if(this.childList[entityIDIndex] === undefined) {
					this.childList[entityIDIndex] = [];
				}
				this.childList[entityIDIndex].push(child.id);
			});

			$(this.data.entityIDs[entityIDIndex]).find('a-image').each((index, child) => {
				if(this.childList[entityIDIndex] === undefined) {
					this.childList[entityIDIndex] = [];
				}
				this.childList[entityIDIndex].push(child.id);
			});

			$(this.data.entityIDs[entityIDIndex]).find('a-plane').each((index, child) => {
				if(this.childColliderPlanes[entityIDIndex] === undefined) {
					this.childColliderPlanes[entityIDIndex] = [];
				}
				this.childColliderPlanes[entityIDIndex].push(child.id);
			});
			
			if(this.entityIndex === entityIDIndex) continue;

			// setVisible in addition to opacity — three.js meshes added via
			// object3D.add (e.g. terrain meshes on mapbox/alltrails widgets)
			// don't respond to the A-Frame `material.opacity` attribute, so
			// they'd flash visible on first paint before the first tick-driven
			// transition called setVisible(false) for us.
			setMatOpacity(this.data.entityIDs[entityIDIndex], 0);
			setVisible(this.data.entityIDs[entityIDIndex], false);

			if(this.childList[entityIDIndex] === undefined) continue;

			this.childList[entityIDIndex].forEach((childID) => {
				setMatOpacity('#' + childID, 0);
				setVisible('#' + childID, false);
			});
		}

		this.cycleStartTime = Date.now();
		this.transitioning = false;
		this.transitionStartTime = Date.now();
		this.hasHiddenEntity = false;
		this.hasUnhiddenEntity = false;
		this.hasFinishedRevealingEntity = false;
		this.waitForDuration = false;
	},
	tick: function() {
		if(this.transitioning) {
			const timeElapsed = Date.now() - this.transitionStartTime;
			const currentID = this.data.entityIDs[this.entityIndex];
			const nextID = this.data.entityIDs[(this.entityIndex + 1) % this.data.numberOfEntities];
			const currentChildren = this.childList[this.entityIndex];
			const nextChildren = this.childList[(this.entityIndex + 1) % this.data.numberOfEntities];
			const currentColliders = this.childColliderPlanes[this.entityIndex];
			const nextColliders = this.childColliderPlanes[(this.entityIndex + 1) % this.data.numberOfEntities];

			if(timeElapsed <= 1000) {
				const fadeOut = 1 - timeElapsed / 1000;
				setMatOpacity(currentID, fadeOut);

				if(currentChildren !== undefined) {
					currentChildren.forEach((childID) => setMatOpacity('#' + childID, fadeOut));
				}
			} else if(timeElapsed <= 2000) {
				if(!this.hasHiddenEntity) {
					setMatOpacity(currentID, 0);
					setVisible(currentID, false);

					if(currentChildren !== undefined) {
						currentChildren.forEach((childID) => {
							setMatOpacity('#' + childID, 0);
							setVisible('#' + childID, false);
						});
					}

					if(currentColliders !== undefined) {
						currentColliders.forEach((childID) => {
							$('#' + childID).removeClass('clickable');
							var raycasterEl = AFRAME.scenes[0].querySelector('[raycaster]');
							raycasterEl.components.raycaster.refreshObjects();
						});
					}

					this.hasHiddenEntity = true;
				}

				if(!this.hasUnhiddenEntity) {
					setVisible(nextID, true);
					setMatOpacity(nextID, 0);

					if(nextChildren !== undefined) {
						nextChildren.forEach((childID) => {
							setVisible('#' + childID, true);
							setMatOpacity('#' + childID, 0);
						});
					}

					this.hasUnhiddenEntity = true;
				}

				const fadeIn = (timeElapsed - 1000) / 1000;
				setMatOpacity(nextID, fadeIn);

				if(nextChildren !== undefined) {
					nextChildren.forEach((childID) => setMatOpacity('#' + childID, fadeIn));
				}
			} else if(timeElapsed > 2000) {
				if(this.hasFinishedRevealingEntity === false) {
					setMatOpacity(nextID, 1);

					if(nextChildren !== undefined) {
						nextChildren.forEach((childID) => setMatOpacity('#' + childID, 1));
					}

					if(nextColliders !== undefined) {
						nextColliders.forEach((childID) => {
							$('#' + childID).addClass('clickable');
							var raycasterEl = AFRAME.scenes[0].querySelector('[raycaster]');
							raycasterEl.components.raycaster.refreshObjects();
						});
					}

					this.hasFinishedRevealingEntity = true;
				}

				this.transitioning = false;
				this.cycleStartTime = Date.now();
				this.entityIndex = (this.entityIndex + 1) % this.data.numberOfEntities;
			}
		} else if(Date.now() - this.cycleStartTime > 10000) {
			this.hasHiddenEntity = false;
			this.hasFinishedRevealingEntity = false;
			this.hasUnhiddenEntity = false;
			this.transitioning = true;
			this.waitForDuration = false;
			this.transitionStartTime = Date.now();
		}
	},
});

AFRAME.registerComponent('slide-image-vertical', {
	schema: {
		percent: { type: 'number', default: 1 },
	},
	init: function() {
		this.lock = false;
		this.lockStartTime = null;

		this.yOffset = 0;
		this.lowerBound = 0.5 - (this.data.percent / 2.0);
		this.upperBound = 0.5 + (this.data.percent / 2.0);

		this.el.addEventListener('materialtextureloaded', e => {
			this.material = this.el.getObject3D('mesh').material;
			this.material.uniforms.lowerBound = { "value": this.lowerBound};
			this.material.uniforms.upperBound = { "value": this.upperBound};			
			this.material.uniforms.yOffset = { "value": this.yOffset };
			this.material.uniforms.multiplier = { "value": this.data.percent };
			this.material.uniforms.aspectRatio = { "value": this.data.aspectRatio };
		});

		this.speed = (1 - this.data.percent) / 3000;
		this.direction = 1.0;
	},
	tick: function() {
		if(this.material === undefined || this.yOffset === undefined) return;

		if((this.yOffset < -this.lowerBound || this.yOffset > this.lowerBound) && !this.lock && !this.ignoreForAFrame) {
			this.direction *= -1.0;
			this.lock = true;
			this.ignoreForAFrame = false;
			this.lockStartTime = Date.now();
		}

		if(!this.lock) {
			this.ignoreForAFrame = false;
			this.yOffset += (this.speed * this.direction);
			this.material.uniforms.yOffset = { "value": this.yOffset };
		} else {
			if(Date.now() - this.lockStartTime > 1000) {
				this.lock = false;
				this.ignoreForAFrame = true;
			}
		}
	}, 
});

AFRAME.registerComponent('check-events', {
	schema: {
		url: { default: '' }
	},
	init: function() {
		this.el.addEventListener('click', e => {
			window.open(this.data.url, '_blank');
		});
	}
});

AFRAME.registerComponent('start-on-touch', {
	init: function() {
		this.el.addEventListener('click', e => {
			if($('#scene').hasClass('not-ready')) {
				return;
			}

			$('#businessCardMarker').attr('position', '0 0 0');
			document.querySelector('#steamWidgetProfileBackgroundVideo')?.play();
			document.querySelector('#steamProfileAvatarFrameVideoTest')?.play();
			$('#businessCardTouch').remove();
		});
	}
});

AFRAME.registerComponent('loading-component', {
	init: function() {

		this.el.addEventListener('model-loaded', e=> {
			const mixer = new THREE.AnimationMixer(this.el.components['gltf-model'].model);
			this.el.components['gltf-model'].model.animations.forEach(clip => {
				let action = mixer.clipAction(clip);
				action.loop = THREE.LoopRepeat;
				action.play();
				this.mixer = mixer;
			})
		})
	},
	tick: function(t, dt) {
		if (!this.mixer) return;
		this.mixer.update(dt / 1000);
	}
});
