/* Globe — same as hackathon prototype but with blue markers and scroll activation */
(function() {
    var container = document.getElementById('globe-container');
    var label = document.getElementById('globe-label');
    if (!container || typeof THREE === 'undefined') return;
    if (window.innerWidth <= 992) return;

    var RADIUS = 1.0, DEG = Math.PI / 180, viewSize = 1.35;
    var scene = new THREE.Scene();
    var W = window.innerWidth, H = window.innerHeight, aspect = W / H;
    var camera = new THREE.OrthographicCamera(-viewSize*aspect, viewSize*aspect, viewSize, -viewSize, 0.1, 10);
    camera.position.z = 4;
    var renderer = new THREE.WebGLRenderer({alpha:true, antialias:true});
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    var globe = new THREE.Group();
    globe.position.x = viewSize * aspect * 0.45;
    scene.add(globe);

    // Solid black sphere (darkens the globe interior)
    globe.add(new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS * 0.997, 64, 64),
        new THREE.ShaderMaterial({
            vertexShader: 'varying float v_depth;void main(){vec4 mvPos=modelViewMatrix*vec4(position,1.0);float zNorm=(-mvPos.z-3.0)/2.0;v_depth=clamp(zNorm,0.0,1.0);gl_Position=projectionMatrix*mvPos;}',
            fragmentShader: 'varying float v_depth;void main(){float alpha=v_depth*0.85;if(alpha<0.01)discard;gl_FragColor=vec4(0.0,0.0,0.0,alpha);}',
            transparent:true, depthWrite:false, side:THREE.DoubleSide
        })
    ));

    // Wireframe (faded over land)
    var wireGeo = new THREE.SphereGeometry(RADIUS, 48, 48);
    var landSet = {};
    var LAND_GRID = 2;
    if (typeof FILL_POINTS !== 'undefined') {
        FILL_POINTS.forEach(function(p){ landSet[Math.round(p[0]/LAND_GRID)+','+Math.round(p[1]/LAND_GRID)] = true; });
    }
    if (typeof FILL_POINTS_HD !== 'undefined') {
        FILL_POINTS_HD.forEach(function(p){ landSet[Math.round(p[0]/LAND_GRID)+','+Math.round(p[1]/LAND_GRID)] = true; });
    }
    var wPos = wireGeo.attributes.position.array;
    var wLand = new Float32Array(wPos.length / 3);
    for (var vi = 0; vi < wPos.length; vi += 3) {
        var lat = Math.asin(wPos[vi+1] / RADIUS) / DEG;
        var lng = Math.atan2(wPos[vi], -wPos[vi+2]) / DEG;
        wLand[vi/3] = landSet[Math.round(lat/LAND_GRID)+','+Math.round(lng/LAND_GRID)] ? 1.0 : 0.0;
    }
    wireGeo.setAttribute('a_land', new THREE.Float32BufferAttribute(wLand, 1));
    var wireMat = new THREE.ShaderMaterial({
        vertexShader: 'attribute float a_land;varying float v_depth;varying float v_land;void main(){vec4 mvPos=modelViewMatrix*vec4(position,1.0);float zNorm=(-mvPos.z-3.0)/2.0;v_depth=clamp(zNorm,0.0,1.0);v_land=a_land;gl_Position=projectionMatrix*mvPos;}',
        fragmentShader: 'varying float v_depth;varying float v_land;void main(){float alpha=v_depth*v_depth*0.08;alpha*=(1.0-v_land*0.9);if(alpha<0.003)discard;gl_FragColor=vec4(0.33,0.33,0.4,alpha);}',
        wireframe:true, transparent:true, depthWrite:false
    });
    globe.add(new THREE.Mesh(wireGeo, wireMat));

    // Depth shader for dots
    var dotVS = 'uniform float u_baseSize;varying float v_depth;void main(){vec4 mvPos=modelViewMatrix*vec4(position,1.0);float zNorm=(-mvPos.z-3.0)/2.0;v_depth=clamp(zNorm,0.0,1.0);gl_PointSize=mix(0.5,u_baseSize,v_depth);gl_Position=projectionMatrix*mvPos;}';
    var dotFS = 'uniform vec3 u_color;uniform float u_maxOpacity;varying float v_depth;void main(){vec2 c=gl_PointCoord-vec2(0.5);float d=length(c);if(d>0.5)discard;float edge=smoothstep(0.5,0.2,d);float alpha=v_depth*u_maxOpacity*edge;if(alpha<0.01)discard;gl_FragColor=vec4(u_color,alpha);}';

    function latLngToVec3(lat, lng, r) {
        var latR=lat*DEG, lngR=lng*DEG;
        return new THREE.Vector3(r*Math.cos(latR)*Math.sin(lngR), r*Math.sin(latR), -r*Math.cos(latR)*Math.cos(lngR));
    }

    // Coast + fill from Natural Earth data
    var coastPos = [];
    COAST_GROUPS.forEach(function(g){g.forEach(function(p){var v=latLngToVec3(p[0],p[1],RADIUS);coastPos.push(v.x,v.y,v.z)})});
    var coastGeo = new THREE.BufferGeometry();
    coastGeo.setAttribute('position', new THREE.Float32BufferAttribute(coastPos, 3));
    globe.add(new THREE.Points(coastGeo, new THREE.ShaderMaterial({uniforms:{u_baseSize:{value:2.5},u_color:{value:new THREE.Color(0.75,0.75,0.8)},u_maxOpacity:{value:0.45}},vertexShader:dotVS,fragmentShader:dotFS,transparent:true,depthWrite:false})));

    var fillPos = [];
    FILL_POINTS.forEach(function(p){var v=latLngToVec3(p[0],p[1],RADIUS);fillPos.push(v.x,v.y,v.z)});
    var fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(fillPos, 3));
    globe.add(new THREE.Points(fillGeo, new THREE.ShaderMaterial({uniforms:{u_baseSize:{value:1.8},u_color:{value:new THREE.Color(0.5,0.5,0.55)},u_maxOpacity:{value:0.35}},vertexShader:dotVS,fragmentShader:dotFS,transparent:true,depthWrite:false})));

    // Country borders
    if (typeof BORDER_GROUPS !== 'undefined') {
        var borderPos = [];
        BORDER_GROUPS.forEach(function(ring){ring.forEach(function(p){var v=latLngToVec3(p[0],p[1],RADIUS*1.003);borderPos.push(v.x,v.y,v.z)})});
        var borderGeo = new THREE.BufferGeometry();
        borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
        globe.add(new THREE.Points(borderGeo, new THREE.ShaderMaterial({uniforms:{u_baseSize:{value:1.8},u_color:{value:new THREE.Color(0.65,0.62,0.75)},u_maxOpacity:{value:0.55}},vertexShader:dotVS,fragmentShader:dotFS,transparent:true,depthWrite:false})));
    }

    // State/province borders
    if (typeof STATE_GROUPS !== 'undefined') {
        var statePos = [];
        STATE_GROUPS.forEach(function(ring){ring.forEach(function(p){var v=latLngToVec3(p[0],p[1],RADIUS*1.002);statePos.push(v.x,v.y,v.z)})});
        var stateGeo = new THREE.BufferGeometry();
        stateGeo.setAttribute('position', new THREE.Float32BufferAttribute(statePos, 3));
        globe.add(new THREE.Points(stateGeo, new THREE.ShaderMaterial({uniforms:{u_baseSize:{value:1.4},u_color:{value:new THREE.Color(0.5,0.52,0.62)},u_maxOpacity:{value:0.35}},vertexShader:dotVS,fragmentShader:dotFS,transparent:true,depthWrite:false})));
    }

    // City markers — BLUE
    var cities = [
        {lat:38.99,lng:-76.85}, {lat:35.68,lng:139.65}, {lat:37.77,lng:-122.42},
        {lat:42.67,lng:-83.22}, {lat:47.61,lng:-122.33}
    ];
    var cityPos = [];
    cities.forEach(function(c){var v=latLngToVec3(c.lat,c.lng,RADIUS*1.005);cityPos.push(v.x,v.y,v.z)});
    var cityGeo = new THREE.BufferGeometry();
    cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityPos, 3));
    globe.add(new THREE.Points(cityGeo, new THREE.ShaderMaterial({uniforms:{u_baseSize:{value:5.5},u_color:{value:new THREE.Color(0.15,0.3,0.8)},u_maxOpacity:{value:0.85}},vertexShader:dotVS,fragmentShader:dotFS,transparent:true,depthWrite:false})));

    // Active marker — brighter blue
    var activeGeo = new THREE.BufferGeometry();
    activeGeo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0], 3));
    var activeMat = new THREE.ShaderMaterial({uniforms:{u_baseSize:{value:8.0},u_color:{value:new THREE.Color(0.2,0.4,1.0)},u_maxOpacity:{value:0.0}},vertexShader:dotVS,fragmentShader:dotFS,transparent:true,depthWrite:false});
    globe.add(new THREE.Points(activeGeo, activeMat));

    // Stars
    var STAR_COUNT = 700;
    var starPositions=[], starAlphas=[], starBaseAlphas=[];
    for(var i=0;i<STAR_COUNT;i++){
        starPositions.push((Math.random()*2-1)*viewSize*aspect*1.2, (Math.random()*2-1)*viewSize*1.2, -1.5);
        var a=0.3+Math.random()*0.3; starAlphas.push(a); starBaseAlphas.push(a);
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    var starAlphaAttr = new THREE.Float32BufferAttribute(starAlphas, 1);
    starGeo.setAttribute('alpha', starAlphaAttr);
    var starMat = new THREE.ShaderMaterial({
        vertexShader:'attribute float alpha;varying float v_alpha;void main(){v_alpha=alpha;gl_PointSize=alpha>0.85?mix(1.8,5.0,(alpha-0.85)/0.15):1.8;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:'varying float v_alpha;void main(){vec2 c=gl_PointCoord-vec2(0.5);if(length(c)>0.5)discard;gl_FragColor=vec4(0.87,0.87,0.93,v_alpha);}',
        transparent:true, depthTest:false
    });
    var stars = new THREE.Points(starGeo, starMat);
    stars.renderOrder = -2;
    scene.add(stars);
    var _globeScreenPos = new THREE.Vector3();

    // State
    var targetRotY=null, targetRotX=null, idleSpeed=0.002, activeCity=null, pulsePhase=0;
    var currentZoom=viewSize, targetZoom=viewSize, ZOOM_IN=viewSize*0.6, ZOOM_OUT=viewSize;
    var leaveTimer=null;

    // Globe activation API (called by scroll observer)
    window.globeActivate = function(lat, lng, loc) {
        if(leaveTimer){clearTimeout(leaveTimer);leaveTimer=null}
        targetRotY = lng * DEG;
        targetRotX = -lat * DEG;
        var v = latLngToVec3(lat, lng, RADIUS*1.01);
        activeGeo.attributes.position.setXYZ(0, v.x, v.y, v.z);
        activeGeo.attributes.position.needsUpdate = true;
        activeMat.uniforms.u_maxOpacity.value = 1.0;
        activeCity = {lat:lat, lng:lng};
        targetZoom = ZOOM_IN;
        label.textContent = loc;
        label.style.opacity = '1';
    };

    // Animation
    var animStart = performance.now();
    function animate() {
        requestAnimationFrame(animate);
        if (document.hidden) return;
        var t = (performance.now() - animStart) / 1000.0;

        if (targetRotY !== null) {
            var dy = targetRotY - globe.rotation.y;
            while(dy>Math.PI)dy-=Math.PI*2; while(dy<-Math.PI)dy+=Math.PI*2;
            globe.rotation.y += dy * 0.04;
            if(targetRotX!==null){globe.rotation.x+=(targetRotX-globe.rotation.x)*0.04}
            pulsePhase += 0.04;
            activeMat.uniforms.u_baseSize.value = 8.0 + Math.sin(pulsePhase) * 3.0;
            activeMat.uniforms.u_maxOpacity.value = 0.8 + Math.sin(pulsePhase) * 0.2;
        } else {
            globe.rotation.y += idleSpeed;
            globe.rotation.x *= 0.98;
        }

        // Zoom — shift camera toward globe so it stays centered when zoomed in
        currentZoom += (targetZoom - currentZoom) * 0.04;
        var zoomFrac = 1.0 - (currentZoom - ZOOM_IN) / (ZOOM_OUT - ZOOM_IN); // 0=out, 1=in
        var camOffsetX = globe.position.x * zoomFrac * 0.35;
        camera.left=-currentZoom*aspect + camOffsetX; camera.right=currentZoom*aspect + camOffsetX;
        camera.top=currentZoom; camera.bottom=-currentZoom;
        camera.updateProjectionMatrix();

        // Star twinkle + supernova + globe culling
        for(var si=0;si<STAR_COUNT;si++){
            var twinkle=0.92+0.08*Math.sin(t*(0.15+si*0.004)+si*2.17);
            starBaseAlphas[si]=starAlphas[si]*twinkle;
            if(Math.random()<0.000024)starBaseAlphas[si]=1.0;
        }
        _globeScreenPos.copy(globe.position).project(camera);
        var screenR = RADIUS / currentZoom;
        var posArr = starGeo.attributes.position.array;
        var _sv = new THREE.Vector3();
        for(var si=0;si<STAR_COUNT;si++){
            _sv.set(posArr[si*3],posArr[si*3+1],posArr[si*3+2]).project(camera);
            var dx=_sv.x-_globeScreenPos.x, dy=_sv.y-_globeScreenPos.y;
            starAlphaAttr.array[si] = (dx*dx+dy*dy < screenR*screenR) ? 0 : starBaseAlphas[si];
        }
        starAlphaAttr.needsUpdate = true;

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function(){
        W=window.innerWidth; H=window.innerHeight; aspect=W/H;
        camera.left=-currentZoom*aspect; camera.right=currentZoom*aspect;
        camera.top=currentZoom; camera.bottom=-currentZoom;
        camera.updateProjectionMatrix();
        globe.position.x = viewSize*aspect*0.45;
        renderer.setSize(W, H);
    });
})();

