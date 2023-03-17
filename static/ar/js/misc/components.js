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


AFRAME.registerComponent('anti-tear2', { // I forgot what this does but it breaks if I remove it
	init: function(){
		let el = this.el;
		let self = this;

		el.addEventListener('materialtextureloaded', function(ev) {
			setTimeout(function () {
				el.sceneEl.renderer.sortObjects = true;
				el.object3D.renderOrder = -1;
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

		this.el.addEventListener('materialtextureloaded', e => {
			this.material = this.el.getObject3D('mesh').material;
			this.material.uniforms.percent = { "value": this.data.percent };
			this.material.uniforms.xOffset = { "value": this.xOffset };
		});

		this.speed = (1 - this.data.percent) / 4000;

	},
	tick: function() {
		if(this.material === undefined || this.xOffset === undefined) return;

		if(this.xOffset > this.stopOffset) {
			this.material.uniforms.xOffset = { "value": 0 };
			this.xOffset = 0;
			this.lock = true;
			this.lockStartTime = Date.now();
		}

		if(!this.lock) {
			this.xOffset += (this.speed * this.direction);

			this.material.uniforms.xOffset = { "value": this.xOffset };
		} else {
			if(Date.now() - this.lockStartTime > 10000) {
				this.material.uniforms.xOffset = { "value": 0 };
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

			$(this.data.entityIDs[entityIDIndex]).attr('material', 'opacity: 0; visible: false');

			if(this.childList[entityIDIndex] === undefined) continue;

			this.childList[entityIDIndex].forEach((childID) => {
				$('#' + childID).attr('material', 'opacity: 0; visible: false');
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

			if(timeElapsed <= 1000) {
				$(this.data.entityIDs[this.entityIndex]).attr('material', 'opacity: ' + (1 - timeElapsed / 1000));

				if(this.childList[this.entityIndex] === undefined) return;

				this.childList[this.entityIndex].forEach((childID) => {
					$('#' + childID).attr('material', 'opacity: ' + (1 - timeElapsed / 1000));
				});
			} else if(timeElapsed <= 2000) {
				if(!hasHiddenEntity) {
					$(this.data.entityIDs[this.entityIndex]).attr('material', 'opacity: 0; visible: false');

					if(this.childList[this.entityIndex] === undefined) return;

					this.childList[this.entityIndex].forEach((childID) => {
						$('#' + childID).attr('material', 'opacity: 0; visible: false');
					});

					hasHiddenEntity = true;
				}

				if(!hasUnhiddenEntity) {
					$(this.data.entityIDs[(this.entityIndex + 1) % this.data.numberOfEntities]).attr('material', 'visible: true');

					this.childList[(this.entityIndex + 1) % this.data.numberOfEntities].forEach((childID) => {
						$('#' + childID).attr('material', 'visible: true');
					});

					hasUnhiddenEntity = true;
				}

				$(this.data.entityIDs[(this.entityIndex + 1) % this.data.numberOfEntities]).attr('material', 'opacity: ' + ((timeElapsed - 1000) / 1000));

				if(this.childList[(this.entityIndex + 1) % this.data.numberOfEntities] === undefined) return;
				
				this.childList[(this.entityIndex + 1) % this.data.numberOfEntities].forEach((childID) => {
					$('#' + childID).attr('material', 'opacity: ' + ((timeElapsed - 1000) / 1000));
				});
			} else if(timeElapsed > 2000) {
				if(!hasRevealedEntity) {
					$(this.data.entityIDs[(this.entityIndex + 1) % this.data.numberOfEntities]).attr('material', 'opacity: 1');

					if(this.childList[(this.entityIndex + 1) % this.data.numberOfEntities] === undefined) return;
					
					this.childList[(this.entityIndex + 1) % this.data.numberOfEntities].forEach((childID) => {
						$('#' + childID).attr('material', 'opacity: 1');

					});

					if(this.entityIndex === 1) {
						this.childList[this.entityIndex].forEach((childID) => {
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

			$(this.data.entityIDs[entityIDIndex]).attr('material', 'opacity: 0');

			if(this.childList[entityIDIndex] === undefined) continue;

			this.childList[entityIDIndex].forEach((childID) => {
				$('#' + childID).attr('material', 'opacity: 0');
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

			if(timeElapsed <= 1000) {
				$(this.data.entityIDs[this.entityIndex]).attr('material', 'opacity: ' + (1 - timeElapsed / 1000));

				if(this.childList[this.entityIndex] !== undefined) {
					this.childList[this.entityIndex].forEach((childID) => {
						$('#' + childID).attr('material', 'opacity: ' + (1 - timeElapsed / 1000));
					});
				}
			} else if(timeElapsed <= 2000) {
				if(!this.hasHiddenEntity) {
					$(this.data.entityIDs[this.entityIndex]).attr('material', 'opacity: 0');
					$(this.data.entityIDs[this.entityIndex]).attr('visible', false);

					if(this.childList[this.entityIndex] !== undefined) {
						this.childList[this.entityIndex].forEach((childID) => {
							$('#' + childID).attr('material', 'opacity: 0');
							$('#' + childID).attr('visible', false);
						});
					}

					if(this.childColliderPlanes[this.entityIndex] !== undefined) {
						this.childColliderPlanes[this.entityIndex].forEach((childID) => {
							$('#' + childID).removeClass('clickable');
							var raycasterEl = AFRAME.scenes[0].querySelector('[raycaster]');
							raycasterEl.components.raycaster.refreshObjects();
						});
					}

					this.hasHiddenEntity = true;
				}

				if(!this.hasUnhiddenEntity) {
					$(this.data.entityIDs[(this.entityIndex + 1) % this.data.numberOfEntities]).attr('visible', true);
					$(this.data.entityIDs[(this.entityIndex + 1) % this.data.numberOfEntities]).attr('material', 'opacity: 0');

					if(this.childList[(this.entityIndex + 1) % this.data.numberOfEntities] !== undefined) {
						this.childList[(this.entityIndex + 1) % this.data.numberOfEntities].forEach((childID) => {
							$('#' + childID).attr('visible', true);
							$('#' + childID).attr('material', 'opacity: 0');
						});
					}

					this.hasUnhiddenEntity = true;
				}

				$(this.data.entityIDs[(this.entityIndex + 1) % this.data.numberOfEntities]).attr('material', 'opacity: ' + ((timeElapsed - 1000) / 1000));

				if(this.childList[(this.entityIndex + 1) % this.data.numberOfEntities] !== undefined) {
					this.childList[(this.entityIndex + 1) % this.data.numberOfEntities].forEach((childID) => {
						$('#' + childID).attr('material', 'opacity: ' + ((timeElapsed - 1000) / 1000));
					});					
				}
			} else if(timeElapsed > 2000) {
				if(this.hasFinishedRevealingEntity === false) {
					$(this.data.entityIDs[(this.entityIndex + 1) % this.data.numberOfEntities]).attr('material', 'opacity: 1');

					if(this.childList[(this.entityIndex + 1) % this.data.numberOfEntities] !== undefined) {
						this.childList[(this.entityIndex + 1) % this.data.numberOfEntities].forEach((childID) => {
							$('#' + childID).attr('material', 'opacity: 1');
						});
					}

					if(this.childColliderPlanes[(this.entityIndex + 1) % this.data.numberOfEntities] !== undefined) {
						this.childColliderPlanes[(this.entityIndex + 1) % this.data.numberOfEntities].forEach((childID) => {
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
			document.querySelector('#steamWidgetProfileBackgroundVideo').play();
			document.querySelector('#steamProfileAvatarFrameVideoTest').play();
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
