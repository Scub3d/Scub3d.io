$(function(){
	function Glitch(canvas, options){
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.origCanvas = document.createElement('canvas');
		this.origContext = this.origCanvas.getContext('2d');
		this.width = canvas.width;
		this.height = canvas.height;
		this.options = options;
	}

	Glitch.prototype.drawImage = function(img, x, y){
		this.canvas.getContext("2d").drawImage(img, x, y);
	};
	
	Glitch.prototype.glitchSlip = function(waveStrength, startHeight, endHeight){
		if(endHeight < startHeight){
			var temp = endHeight;
			endHeight = startHeight;
			startHeight = temp;
		}

		for(var h = startHeight; h < endHeight; h++){
			if(Math.random() < 0.1)h++;
			var image = this.ctx.getImageData(0, h, this.width, 1);
			this.ctx.putImageData(image, Math.random()*waveStrength-(waveStrength/2), h); 
		}
	};
	
	Glitch.prototype.glitchFillRandom = function(fillCnt, cuttingMaxHeight){
		var cw = this.width;
		var ch = this.height;
		for(var i = 0; i< fillCnt; i++){
			var rndX = cw * Math.random();
			var rndY = ch * Math.random();
			var rndW = cw * Math.random();
			var rndH = cuttingMaxHeight * Math.random();
			if(rndW < 1 || rndH < 1) return;
			var image = this.ctx.getImageData(rndX, rndY, rndW, rndH);
			this.ctx.putImageData(image, (rndX * Math.random()) % cw, rndY);
		}
	}
	
	function video(callback){
		var video = document.createElement('video');
		video.crossOrigin = 'anonymous';
		video.controls = false;
		video.autoplay = true;
		video.loop = true;
		video.muted = true;
		var source = document.createElement('source');
		source.src = '//static.scub3d.io/www/img/index/me.ogv';
		source.type = 'video/ogg';
		video.appendChild(source);
		this.video = video;
		this.source = source;
		if(callback !== null){
			video.addEventListener('loadeddata', callback);
		}
	};

	var FPS = 30;
	var frame = 0;
	var vG = new video(sync);

	var interval;
	function sync(){
		var canvas = document.getElementById("myCanvas");
		var _glitch = new Glitch(canvas);
		interval = setInterval(function(){
			frame++;
			_glitch.drawImage(vG.video, 0, 0); 
			if(frame % 100 < 20){
				_glitch.glitchFillRandom(5, 20);
			}
			if(80 < frame % 100){
				_glitch.glitchSlip(10,200,300);
			}
			if(95 < frame % 100){
				_glitch.glitchSlip(10,100* Math.random(),400 * Math.random());
			}
		}, 1000/FPS);
	}
});