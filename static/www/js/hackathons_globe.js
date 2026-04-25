/* ============================================================
   DOT-MATRIX GLOBE (dense land mask approach)
   ============================================================ */
(function () {
    const container = document.getElementById('globe-container');
    const label = document.getElementById('globe-label');
    if (!container || typeof THREE === 'undefined') return;
    if (window.innerWidth <= 992) return;

    const RADIUS = 1.0;
    const DEG = Math.PI / 180;
    const viewSize = 1.35;

    // --- Scene setup (full-screen canvas) ---
    const scene = new THREE.Scene();
    var W = window.innerWidth;
    var H = window.innerHeight;
    var aspect = W / H;
    const camera = new THREE.OrthographicCamera(
        -viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 10
    );
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- Globe group (everything rotates together, offset to right side) ---
    const globe = new THREE.Group();
    globe.position.x = viewSize * aspect * 0.45; // push to right side of screen
    scene.add(globe);

    // --- Solid black sphere (darkens the globe interior) ---
    globe.add(new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS * 0.997, 64, 64),
        new THREE.ShaderMaterial({
            vertexShader: 'varying float v_depth;\nvoid main() {\n    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);\n    float zNorm = (-mvPos.z - 3.0) / 2.0;\n    v_depth = clamp(zNorm, 0.0, 1.0);\n    gl_Position = projectionMatrix * mvPos;\n}',
            fragmentShader: 'varying float v_depth;\nvoid main() {\n    float alpha = v_depth * 0.85;\n    if (alpha < 0.01) discard;\n    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);\n}',
            transparent: true, depthWrite: false, side: THREE.DoubleSide
        })
    ));

    // --- Faint wireframe sphere (faded over land) ---
    const wireGeo = new THREE.SphereGeometry(RADIUS, 48, 48);

    // Build land lookup to fade wireframe over land
    var landSet = {};
    var LAND_GRID = 2;
    if (typeof FILL_POINTS !== 'undefined') {
        FILL_POINTS.forEach(function (p) {
            var key = Math.round(p[0] / LAND_GRID) + ',' + Math.round(p[1] / LAND_GRID);
            landSet[key] = true;
        });
    }
    if (typeof FILL_POINTS_HD !== 'undefined') {
        FILL_POINTS_HD.forEach(function (p) {
            var key = Math.round(p[0] / LAND_GRID) + ',' + Math.round(p[1] / LAND_GRID);
            landSet[key] = true;
        });
    }
    var posArr = wireGeo.attributes.position.array;
    var landAttr = new Float32Array(posArr.length / 3);
    for (var vi = 0; vi < posArr.length; vi += 3) {
        var x = posArr[vi], y = posArr[vi + 1], z = posArr[vi + 2];
        var lat = Math.asin(y / RADIUS) / DEG;
        var lng = Math.atan2(x, -z) / DEG;
        var key = Math.round(lat / LAND_GRID) + ',' + Math.round(lng / LAND_GRID);
        landAttr[vi / 3] = landSet[key] ? 1.0 : 0.0;
    }
    wireGeo.setAttribute('a_land', new THREE.Float32BufferAttribute(landAttr, 1));

    const wireMat = new THREE.ShaderMaterial({
        vertexShader: 'attribute float a_land;\nvarying float v_depth;\nvarying float v_land;\nvoid main() {\n    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);\n    float zNorm = (-mvPos.z - 3.0) / 2.0;\n    v_depth = clamp(zNorm, 0.0, 1.0);\n    v_land = a_land;\n    gl_Position = projectionMatrix * mvPos;\n}',
        fragmentShader: 'varying float v_depth;\nvarying float v_land;\nvoid main() {\n    float alpha = v_depth * v_depth * 0.08;\n    alpha *= (1.0 - v_land * 0.9);\n    if (alpha < 0.003) discard;\n    gl_FragColor = vec4(0.33, 0.33, 0.4, alpha);\n}',
        wireframe: true,
        transparent: true,
        depthWrite: false
    });
    globe.add(new THREE.Mesh(wireGeo, wireMat));

    // --- Depth-aware shader for dots ---
    const dotVertShader = `
uniform float u_baseSize;
varying float v_depth;
void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    float zNorm = (-mvPos.z - 3.0) / 2.0;
    v_depth = clamp(zNorm, 0.0, 1.0);
    gl_PointSize = mix(0.5, u_baseSize, v_depth);
    gl_Position = projectionMatrix * mvPos;
}
    `;
    const dotFragShader = `
uniform vec3 u_color;
uniform float u_maxOpacity;
varying float v_depth;
void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.2, d);
    float alpha = v_depth * u_maxOpacity * edge;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(u_color, alpha);
}
    `;

    // --- Lat/Lng to 3D position (Y=up, Z=toward camera at lng=0) ---
    function latLngToVec3(lat, lng, r) {
        var latR = lat * DEG;
        var lngR = lng * DEG;
        return new THREE.Vector3(
            r * Math.cos(latR) * Math.sin(lngR),   // X
            r * Math.sin(latR),                      // Y: up
            -r * Math.cos(latR) * Math.cos(lngR)     // Z: flipped so outer surface faces camera
        );
    }

    // --- LAYER 1: Coastline outlines from Natural Earth data ---
    // COAST_GROUPS loaded from globe/coast_lod0.js — arrays of [lat,lng] pairs
    const coastPositions = [];
    COAST_GROUPS.forEach(function (group) {
        group.forEach(function (pt) {
            var v = latLngToVec3(pt[0], pt[1], RADIUS);
            coastPositions.push(v.x, v.y, v.z);
        });
    });
    var coastGeo = new THREE.BufferGeometry();
    coastGeo.setAttribute('position', new THREE.Float32BufferAttribute(coastPositions, 3));
    var coastMat = new THREE.ShaderMaterial({
        uniforms: {
            u_baseSize: { value: 2.5 },
            u_color: { value: new THREE.Color(0.75, 0.75, 0.8) },
            u_maxOpacity: { value: 0.45 }
        },
        vertexShader: dotVertShader, fragmentShader: dotFragShader,
        transparent: true, depthWrite: false
    });
    globe.add(new THREE.Points(coastGeo, coastMat));

    // --- LAYER 2: Sparse dim land fill from Natural Earth data ---
    // FILL_POINTS loaded from globe/coast_lod0.js — [lat,lng] pairs
    const fillPositions = [];
    FILL_POINTS.forEach(function (pt) {
        var v = latLngToVec3(pt[0], pt[1], RADIUS);
        fillPositions.push(v.x, v.y, v.z);
    });
    var fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(fillPositions, 3));
    var fillMat = new THREE.ShaderMaterial({
        uniforms: {
            u_baseSize: { value: 1.8 },
            u_color: { value: new THREE.Color(0.5, 0.5, 0.55) },
            u_maxOpacity: { value: 0.35 }
        },
        vertexShader: dotVertShader, fragmentShader: dotFragShader,
        transparent: true, depthWrite: false
    });
    globe.add(new THREE.Points(fillGeo, fillMat));

    // --- Country borders ---
    if (typeof BORDER_GROUPS !== 'undefined') {
        var borderPos = [];
        BORDER_GROUPS.forEach(function (ring) {
            ring.forEach(function (p) {
                var v = latLngToVec3(p[0], p[1], RADIUS * 1.003);
                borderPos.push(v.x, v.y, v.z);
            });
        });
        var borderGeo = new THREE.BufferGeometry();
        borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
        globe.add(new THREE.Points(borderGeo, new THREE.ShaderMaterial({
            uniforms: { u_baseSize: { value: 1.8 }, u_color: { value: new THREE.Color(0.65, 0.62, 0.75) }, u_maxOpacity: { value: 0.55 } },
            vertexShader: dotVertShader, fragmentShader: dotFragShader,
            transparent: true, depthWrite: false
        })));
    }

    // --- State/province borders ---
    if (typeof STATE_GROUPS !== 'undefined') {
        var statePos = [];
        STATE_GROUPS.forEach(function (ring) {
            ring.forEach(function (p) {
                var v = latLngToVec3(p[0], p[1], RADIUS * 1.002);
                statePos.push(v.x, v.y, v.z);
            });
        });
        var stateGeo = new THREE.BufferGeometry();
        stateGeo.setAttribute('position', new THREE.Float32BufferAttribute(statePos, 3));
        globe.add(new THREE.Points(stateGeo, new THREE.ShaderMaterial({
            uniforms: { u_baseSize: { value: 1.4 }, u_color: { value: new THREE.Color(0.5, 0.52, 0.62) }, u_maxOpacity: { value: 0.35 } },
            vertexShader: dotVertShader, fragmentShader: dotFragShader,
            transparent: true, depthWrite: false
        })));
    }

    // --- City markers (all hackathon locations) ---
    const cities = [
        { lat: 40.12, lng: -88.24, name: 'Champaign' },
        { lat: 42.74, lng: -84.48, name: 'East Lansing' },
        { lat: 41.15, lng: -81.36, name: 'Kent' },
        { lat: 40.68, lng: -74.40, name: 'Bell Labs' },
        { lat: 43.46, lng: -80.52, name: 'Waterloo' },
        { lat: 42.28, lng: -83.74, name: 'Ann Arbor' },
        { lat: 35.68, lng: 139.65, name: 'Tokyo' },
        { lat: 39.10, lng: -84.51, name: 'Cincinnati' },
        { lat: 41.50, lng: -81.69, name: 'Cleveland' },
        { lat: 43.16, lng: -77.61, name: 'Rochester' },
        { lat: 60.17, lng: 24.94, name: 'Helsinki' },
        { lat: 34.05, lng: -118.24, name: 'Los Angeles' },
        { lat: 32.72, lng: -117.16, name: 'San Diego' },
    ];

    const cityPositions = [];
    cities.forEach(function (c) {
        const v = latLngToVec3(c.lat, c.lng, RADIUS * 1.005);
        cityPositions.push(v.x, v.y, v.z);
    });

    const cityGeo = new THREE.BufferGeometry();
    cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityPositions, 3));
    const cityMat = new THREE.ShaderMaterial({
        uniforms: {
            u_baseSize: { value: 5.5 },
            u_color: { value: new THREE.Color(0.6, 0.15, 0.12) },
            u_maxOpacity: { value: 0.85 }
        },
        vertexShader: dotVertShader,
        fragmentShader: dotFragShader,
        transparent: true,
        depthWrite: false
    });
    const cityPoints = new THREE.Points(cityGeo, cityMat);
    globe.add(cityPoints);

    // --- Active marker (highlighted city) ---
    const activeGeo = new THREE.BufferGeometry();
    activeGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const activeMat = new THREE.ShaderMaterial({
        uniforms: {
            u_baseSize: { value: 8.0 },
            u_color: { value: new THREE.Color(0.8, 0.2, 0.15) },
            u_maxOpacity: { value: 0.0 }
        },
        vertexShader: dotVertShader,
        fragmentShader: dotFragShader,
        transparent: true,
        depthWrite: false
    });
    const activePoint = new THREE.Points(activeGeo, activeMat);
    globe.add(activePoint);


    // --- Background stars (scattered across full viewport, culled behind globe) ---
    var STAR_COUNT = 700;
    var starPositions = [];
    var starAlphas = [];
    var starBaseAlphas = [];
    for (var i = 0; i < STAR_COUNT; i++) {
        var sx = (Math.random() * 2 - 1) * viewSize * aspect * 1.2;
        var sy = (Math.random() * 2 - 1) * viewSize * 1.2;
        starPositions.push(sx, sy, -1.5);
        var a = 0.3 + Math.random() * 0.3;
        starAlphas.push(a);
        starBaseAlphas.push(a);
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    var starAlphaAttr = new THREE.Float32BufferAttribute(starAlphas, 1);
    starGeo.setAttribute('alpha', starAlphaAttr);
    var starMat = new THREE.ShaderMaterial({
        vertexShader: `
    attribute float alpha;
    varying float v_alpha;
    void main() {
        v_alpha = alpha;
        gl_PointSize = alpha > 0.85 ? mix(1.8, 5.0, (alpha - 0.85) / 0.15) : 1.8;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,
        fragmentShader: `
    varying float v_alpha;
    void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        if (length(c) > 0.5) discard;
        gl_FragColor = vec4(0.87, 0.87, 0.93, v_alpha);
    }
`,
        transparent: true,
        depthTest: false
    });
    var stars = new THREE.Points(starGeo, starMat);
    stars.renderOrder = -2;
    scene.add(stars);
    var _globeScreenPos = new THREE.Vector3();

    // --- State ---
    let targetRotY = null;
    let targetRotX = null;
    let idleSpeed = 0.001;
    let activeCity = null;
    let pulsePhase = 0;
    let leaveTimer = null;
    let currentZoom = viewSize;
    let targetZoom = viewSize;
    var ZOOM_IN = viewSize * 0.6;  // 40% zoom when hovering
    var ZOOM_OUT = viewSize;

    // --- Card hover listeners ---
    document.querySelectorAll('.hack-card').forEach(function (card) {
        card.addEventListener('mouseenter', function () {
            // Cancel any pending leave timer
            if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }

            // Find city name for label
            var cityName = '';
            var locEl = card.querySelector('.hack-card-location .displayText');
            if (locEl) cityName = locEl.textContent;
            if (!cityName) {
                locEl = card.querySelector('.hack-card-location .englishText');
                if (locEl) cityName = locEl.textContent;
            }
            label.textContent = cityName;
            label.style.opacity = '1';

            const lat = parseFloat(card.dataset.lat);
            const lng = parseFloat(card.dataset.lng);
            if (isNaN(lat) || isNaN(lng)) {
                // Online event — reset globe to idle
                targetRotY = null;
                targetRotX = null;
                activeMat.uniforms.u_maxOpacity.value = 0.0;
                activeCity = null;
                targetZoom = ZOOM_OUT;
                return;
            }

            // Target rotation to face the city
            targetRotY = lng * DEG;
            targetRotX = -lat * DEG; // full vertical rotation so city faces straight out

            // Position active marker
            const v = latLngToVec3(lat, lng, RADIUS * 1.01);
            activeGeo.attributes.position.setXYZ(0, v.x, v.y, v.z);
            activeGeo.attributes.position.needsUpdate = true;
            activeMat.uniforms.u_maxOpacity.value = 1.0;

            pulsePhase = 0;

            activeCity = { lat: lat, lng: lng };
            targetZoom = ZOOM_IN;
        });

        card.addEventListener('mouseleave', function () {
            leaveTimer = setTimeout(function () {
                targetRotY = null;
                targetRotX = null;
                activeMat.uniforms.u_maxOpacity.value = 0.0;
                activeCity = null;
                targetZoom = ZOOM_OUT;
                label.style.opacity = '0';
                leaveTimer = null;
            }, 300);
        });
    });

    // --- Animation loop ---
    var animStart = performance.now();
    function animate() {
        requestAnimationFrame(animate);
        if (document.hidden) return;
        var t = (performance.now() - animStart) / 1000.0;

        if (targetRotY !== null) {
            // Smooth rotation to target
            let dy = targetRotY - globe.rotation.y;
            // Shortest path
            while (dy > Math.PI) dy -= Math.PI * 2;
            while (dy < -Math.PI) dy += Math.PI * 2;
            globe.rotation.y += dy * 0.04;

            if (targetRotX !== null) {
                let dx = targetRotX - globe.rotation.x;
                globe.rotation.x += dx * 0.04;
            }

            // Pulse the active dot
            pulsePhase += 0.04;
            var pulseSize = 8.0 + Math.sin(pulsePhase) * 3.0;
            var pulseAlpha = 0.8 + Math.sin(pulsePhase) * 0.2;
            activeMat.uniforms.u_baseSize.value = pulseSize;
            activeMat.uniforms.u_maxOpacity.value = pulseAlpha;
        } else {
            // Idle rotation
            globe.rotation.y += idleSpeed;
            // Slowly return x tilt to 0
            globe.rotation.x *= 0.98;
        }

        // Smooth zoom — shift camera toward globe so it stays centered when zoomed in
        currentZoom += (targetZoom - currentZoom) * 0.04;
        var zoomFrac = 1.0 - (currentZoom - ZOOM_IN) / (ZOOM_OUT - ZOOM_IN);
        var camOffsetX = globe.position.x * zoomFrac * 0.25;
        camera.left = -currentZoom * aspect + camOffsetX;
        camera.right = currentZoom * aspect + camOffsetX;
        camera.top = currentZoom;
        camera.bottom = -currentZoom;
        camera.updateProjectionMatrix();

        // Star twinkle + rare supernova
        for (var si = 0; si < STAR_COUNT; si++) {
            // Soft twinkle: very subtle sine wave
            var twinkle = 0.92 + 0.08 * Math.sin(t * (0.15 + si * 0.004) + si * 2.17);
            starBaseAlphas[si] = starAlphas[si] * twinkle;

            // Rare supernova (~1 per minute at 60fps: 1/(60*60*700) ≈ 0.000024)
            if (Math.random() < 0.000024) {
                starBaseAlphas[si] = 1.0;
                starGeo.attributes.position.array[si * 3 + 2] = -1.5; // keep z
                // Temporarily boost size via alpha (shader reads it)
            }
        }

        // Cull stars behind the globe (screen-space circle test)
        _globeScreenPos.copy(globe.position).project(camera);
        var screenR = RADIUS / currentZoom; // globe radius in NDC space
        var posArr = starGeo.attributes.position.array;
        var _sv = new THREE.Vector3();
        for (var si = 0; si < STAR_COUNT; si++) {
            _sv.set(posArr[si * 3], posArr[si * 3 + 1], posArr[si * 3 + 2]).project(camera);
            var dx = _sv.x - _globeScreenPos.x;
            var dy = _sv.y - _globeScreenPos.y;
            if (dx * dx + dy * dy < screenR * screenR) {
                starAlphaAttr.array[si] = 0;
            } else {
                starAlphaAttr.array[si] = starBaseAlphas[si];
            }
        }
        starAlphaAttr.needsUpdate = true;

        renderer.render(scene, camera);
    }

    animate();

    // --- Resize ---
    function onResize() {
        W = window.innerWidth;
        H = window.innerHeight;
        aspect = W / H;
        camera.left = -currentZoom * aspect;
        camera.right = currentZoom * aspect;
        camera.top = currentZoom;
        camera.bottom = -currentZoom;
        camera.updateProjectionMatrix();
        globe.position.x = viewSize * aspect * 0.45;
        renderer.setSize(W, H);
    }
    window.addEventListener('resize', onResize);
})();

