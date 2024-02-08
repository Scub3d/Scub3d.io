$(document).ready(function(){
	document.getElementById("grid").querySelectorAll('.grid__item > .grid__video').forEach(function(item) {
		item.classList.add("grid__video__not__active");
	});
	
	setTimeout(function() { 
		var effects = {
			lineDrawing: true,
			animeLineDrawingOpts: {
				duration: 800,
				delay: function(t,i) {
					return i*150;
				},
				easing: 'easeInOutSine',
				strokeDashoffset: [anime.setDashoffset, 0],
				opacity: [
					{value: [0,1]},
					{value: [1,0], duration: 200, easing: 'linear', delay:500}
				]
			},
			animeOpts: {
				duration: 800,
				easing: [0.2,1,0.3,1],
				delay: function(t,i) {
					return i*150 + 800;
				},
				opacity: {
					value: [0,1],
					easing: 'linear'
				},
				scale: [0.5,1]
			}
		};

		function _render(effect, el, items) {
			_resetStyles(el, items);
			var self = this,
				effectSettings = effect,
				animeOpts = effectSettings.animeOpts;

			if( effectSettings.perspective != undefined ) {
				items.forEach(function(item) { 
					item.parentNode.style.WebkitPerspective = item.parentNode.style.perspective = effectSettings.perspective + 'px';
				});
			}
			
			if( effectSettings.origin != undefined ) {
				items.forEach(function(item) { 
					item.style.WebkitTransformOrigin = item.style.transformOrigin = effectSettings.origin;
				});
			}

			if( effectSettings.lineDrawing != undefined ) {
				items.forEach(function(item) { 
					var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
						path = document.createElementNS('http://www.w3.org/2000/svg', 'path'),
						itemW = item.offsetWidth,
						itemH = item.offsetHeight;

					svg.setAttribute('width', itemW + 'px');
					svg.setAttribute('height', itemH + 'px');
					svg.setAttribute('viewBox', '0 0 ' + itemW + ' ' + itemH);
					svg.setAttribute('class', 'grid__deco');
					path.setAttribute('d', 'M0,0 l' + itemW + ',0 0,' + itemH + ' -' + itemW + ',0 0,-' + itemH);
					path.setAttribute('stroke-dashoffset', anime.setDashoffset(path));
					svg.appendChild(path);
					item.parentNode.appendChild(svg);
				});

				var animeLineDrawingOpts = effectSettings.animeLineDrawingOpts;
				animeLineDrawingOpts.targets = el.querySelectorAll('.grid__deco > path');
				anime.remove(animeLineDrawingOpts.targets);
				anime(animeLineDrawingOpts);
			}

			if( effectSettings.revealer != undefined ) {
				items.forEach(function(item) { 
					var revealer = document.createElement('div');
					revealer.className = 'grid__reveal';
					if( effectSettings.revealerOrigin != undefined ) {
						revealer.style.transformOrigin = effectSettings.revealerOrigin;
					}
					if( effectSettings.revealerColor != undefined ) {
						revealer.style.backgroundColor = effectSettings.revealerColor;
					}
					item.parentNode.appendChild(revealer);
				});

				var animeRevealerOpts = effectSettings.animeRevealerOpts;
				animeRevealerOpts.targets = el.querySelectorAll('.grid__reveal');
				animeRevealerOpts.begin = function(obj) {
					for(var i = 0, len = obj.animatables.length; i < len; ++i) {
						obj.animatables[i].target.style.opacity = 1;
					}
				};
				anime.remove(animeRevealerOpts.targets);
				anime(animeRevealerOpts);
			}

			if( effectSettings.itemOverflowHidden ) {
				items.forEach(function(item) {
					item.parentNode.style.overflow = 'hidden';
				});
			}

			animeOpts.targets = effectSettings.sortTargetsFn && typeof effectSettings.sortTargetsFn === 'function' ? items.sort(effectSettings.sortTargetsFn) : items;
			anime.remove(animeOpts.targets);
			anime(animeOpts);
		};

		function _resetStyles(el, items) {
			el.style.WebkitPerspective = el.style.perspective = 'none';
			items.forEach(function(item) {
							item.classList.remove("grid__video__not__active");
				var gItem = item.parentNode;
				item.style.opacity = 0;
				item.style.WebkitTransformOrigin = item.style.transformOrigin = '50% 50%';
				item.style.transform = 'none';

				var svg = item.parentNode.querySelector('svg.grid__deco');
				if( svg ) {
					gItem.removeChild(svg);
				}

				var revealer = item.parentNode.querySelector('.grid__reveal');
				if( revealer ) {
					gItem.removeChild(revealer);
				}

				gItem.style.overflow = '';
			});
		};

		var body = document.body, grid = document.getElementById("grid");
		
		imagesLoaded(body, function() {
			var masonry = new Masonry(grid, {
				itemSelector: '.grid__item',
				columnWidth: '.grid__sizer',
				percentPosition: true,
				transitionDuration: 0
			});
			_render(effects, grid, grid.querySelectorAll('.grid__item > .grid__video'));
		});
	}, 500);
});