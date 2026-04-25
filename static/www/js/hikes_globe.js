(function () {
    var container = document.getElementById('globe-container');
    var label = document.getElementById('globe-label');
    if (!container || typeof THREE === 'undefined') return;
    // Skip globe on mobile — hidden via CSS and saves GPU/memory
    if (window.innerWidth <= 992) return;

    // Wait for container to have dimensions (fixed positioning may not be ready)
    function waitForLayout(cb) {
        if (container.clientWidth > 0 && container.clientHeight > 0) { cb(); return; }
        requestAnimationFrame(function () { waitForLayout(cb); });
    }
    waitForLayout(initGlobe);

    function initGlobe() {
        var RADIUS = 1.0, DEG = Math.PI / 180, viewSize = 1.35;
        var scene = new THREE.Scene();
        var W = container.clientWidth, H = container.clientHeight, aspect = W / H;
        var camera = new THREE.OrthographicCamera(
            -viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 10
        );
        camera.position.z = 4;

        var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        var globe = new THREE.Group();
        scene.add(globe);

        // Resize handler
        window.addEventListener('resize', function () {
            W = container.clientWidth; H = container.clientHeight; aspect = W / H;
            renderer.setSize(W, H);
            camera.left = -currentZoom * aspect; camera.right = currentZoom * aspect;
            camera.top = currentZoom; camera.bottom = -currentZoom;
            camera.updateProjectionMatrix();
        });

        function latLngToVec3(lat, lng, r) {
            var latR = lat * DEG;
            var lngR = lng * DEG;
            return new THREE.Vector3(
                r * Math.cos(latR) * Math.sin(lngR),
                r * Math.sin(latR),
                -r * Math.cos(latR) * Math.cos(lngR)
            );
        }

        // --- Solid two-tone sphere (ocean=blue, land=dark green) ---
        var solidGeo = new THREE.SphereGeometry(RADIUS * 0.997, 64, 64);
        var landTexture = null;
        if (typeof LAND_MASK_B64 !== 'undefined') {
            // Decode base64 bitfield into RGBA texture
            var raw = atob(LAND_MASK_B64);
            var maskW = LAND_MASK_W, maskH = LAND_MASK_H;
            var total = maskW * maskH;
            var texData = new Uint8Array(total * 4);
            for (var ti = 0; ti < total; ti++) {
                var val = (raw.charCodeAt(ti >> 3) >> (ti & 7)) & 1 ? 255 : 0;
                texData[ti * 4] = val;
                texData[ti * 4 + 1] = val;
                texData[ti * 4 + 2] = val;
                texData[ti * 4 + 3] = 255;
            }
            landTexture = new THREE.DataTexture(texData, maskW, maskH, THREE.RGBAFormat);
            landTexture.minFilter = THREE.LinearFilter;
            landTexture.magFilter = THREE.LinearFilter;
            landTexture.wrapS = THREE.RepeatWrapping;
            landTexture.wrapT = THREE.ClampToEdgeWrapping;
            landTexture.needsUpdate = true;
        }

        // --- Wireframe sphere (faded over land) ---
        var sphereGeo = new THREE.SphereGeometry(RADIUS, 48, 48);

        // Build land lookup from FILL_POINTS to mark sphere vertices as land/water
        var landSet = {};
        var LAND_GRID = 2; // degrees per cell — matches HD fill grid resolution
        if (typeof FILL_POINTS !== 'undefined') {
            FILL_POINTS.forEach(function (p) {
                var key = Math.round(p[0] / LAND_GRID) + ',' + Math.round(p[1] / LAND_GRID);
                landSet[key] = true;
            });
        }
        // Also check HD fill if available for better coverage
        if (typeof FILL_POINTS_HD !== 'undefined') {
            FILL_POINTS_HD.forEach(function (p) {
                var key = Math.round(p[0] / LAND_GRID) + ',' + Math.round(p[1] / LAND_GRID);
                landSet[key] = true;
            });
        }

        // Tag each sphere vertex as land (1) or water (0)
        var posArr = sphereGeo.attributes.position.array;
        var landAttr = new Float32Array(posArr.length / 3);
        for (var vi = 0; vi < posArr.length; vi += 3) {
            var x = posArr[vi], y = posArr[vi + 1], z = posArr[vi + 2];
            var lat = Math.asin(y / RADIUS) / DEG;
            var lng = Math.atan2(x, -z) / DEG;
            var key = Math.round(lat / LAND_GRID) + ',' + Math.round(lng / LAND_GRID);
            landAttr[vi / 3] = landSet[key] ? 1.0 : 0.0;
        }
        sphereGeo.setAttribute('a_land', new THREE.Float32BufferAttribute(landAttr, 1));

        // Two-tone solid sphere
        globe.add(new THREE.Mesh(solidGeo, new THREE.ShaderMaterial({
            uniforms: {
                u_landMask: { value: landTexture },
                u_radius: { value: RADIUS * 0.997 }
            },
            vertexShader: [
                'varying float v_depth;',
                'varying vec3 v_modelPos;',
                'void main() {',
                '    v_modelPos = position;',
                '    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
                '    float zNorm = (-mvPos.z - 3.0) / 2.0;',
                '    v_depth = clamp(zNorm, 0.0, 1.0);',
                '    gl_Position = projectionMatrix * mvPos;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform sampler2D u_landMask;',
                'uniform float u_radius;',
                'varying float v_depth;',
                'varying vec3 v_modelPos;',
                'void main() {',
                '    float alpha = (v_depth) * 0.85;',
                '    if (alpha < 0.01) discard;',
                '    float lat = asin(clamp(v_modelPos.y / u_radius, -1.0, 1.0));',
                '    float lng = atan(v_modelPos.x, -v_modelPos.z);',
                '    float u = (lng / 3.14159265 + 1.0) * 0.5;',
                '    float v = (lat / 1.5707963 + 1.0) * 0.5;',
                '    float land = texture2D(u_landMask, vec2(u, v)).r;',
                '    // vec3 oceanColor = vec3(0.1, 0.15, 0.3);',
                '    // vec3 landColor = vec3(0.06, 0.15, 0.06);',
                '    // vec3 color = mix(oceanColor, landColor, step(0.5, land));',
                '    vec3 color = vec3(0.0, 0.0, 0.0);',
                '    gl_FragColor = vec4(color, alpha);',
                '}'
            ].join('\n'),
            transparent: true, depthWrite: false, side: THREE.DoubleSide
        })));

        // Wireframe sphere
        globe.add(new THREE.Mesh(sphereGeo, new THREE.ShaderMaterial({
            vertexShader: [
                'attribute float a_land;',
                'varying float v_depth;',
                'varying float v_land;',
                'void main() {',
                '    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
                '    float zNorm = (-mvPos.z - 3.0) / 2.0;',
                '    v_depth = clamp(zNorm, 0.0, 1.0);',
                '    v_land = a_land;',
                '    gl_Position = projectionMatrix * mvPos;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'varying float v_depth;',
                'varying float v_land;',
                'void main() {',
                '    float alpha = v_depth * v_depth * 0.08;',
                '    alpha *= (1.0 - v_land * 0.9);',
                '    if (alpha < 0.003) discard;',
                '    gl_FragColor = vec4(0.33, 0.33, 0.4, alpha);',
                '}'
            ].join('\n'),
            wireframe: true, transparent: true, depthWrite: false
        })));

        // --- Dot shaders ---
        var dotVertShader = [
            'uniform float u_baseSize;',
            'varying float v_depth;',
            'void main() {',
            '    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
            '    float zNorm = (-mvPos.z - 3.0) / 2.0;',
            '    v_depth = clamp(zNorm, 0.0, 1.0);',
            '    gl_PointSize = mix(0.5, u_baseSize, v_depth);',
            '    gl_Position = projectionMatrix * mvPos;',
            '}'
        ].join('\n');

        var dotFragShader = [
            'uniform vec3 u_color;',
            'uniform float u_maxOpacity;',
            'varying float v_depth;',
            'void main() {',
            '    vec2 c = gl_PointCoord - vec2(0.5);',
            '    float d = length(c);',
            '    if (d > 0.5) discard;',
            '    float edge = smoothstep(0.5, 0.2, d);',
            '    float alpha = v_depth * u_maxOpacity * edge;',
            '    if (alpha < 0.01) discard;',
            '    gl_FragColor = vec4(u_color, alpha);',
            '}'
        ].join('\n');

        // Per-vertex size shader for hike dots
        var hikeDotVertShader = [
            'attribute float a_size;',
            'varying float v_depth;',
            'void main() {',
            '    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
            '    float zNorm = (-mvPos.z - 3.0) / 2.0;',
            '    v_depth = clamp(zNorm, 0.0, 1.0);',
            '    gl_PointSize = mix(0.5, a_size, v_depth);',
            '    gl_Position = projectionMatrix * mvPos;',
            '}'
        ].join('\n');

        // --- Helper: build points from ring groups ---
        function buildPointsFromGroups(groups, radius) {
            var pos = [];
            groups.forEach(function (ring) {
                ring.forEach(function (p) {
                    var v = latLngToVec3(p[0], p[1], radius);
                    pos.push(v.x, v.y, v.z);
                });
            });
            return pos;
        }

        function buildPointsFromFlat(points, radius) {
            var pos = [];
            points.forEach(function (p) {
                var v = latLngToVec3(p[0], p[1], radius);
                pos.push(v.x, v.y, v.z);
            });
            return pos;
        }

        function makePointsLayer(positions, opts) {
            var geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            var mesh = new THREE.Points(geo, new THREE.ShaderMaterial({
                uniforms: {
                    u_baseSize: { value: opts.size || 2.5 },
                    u_color: { value: new THREE.Color(opts.r || 0.75, opts.g || 0.75, opts.b || 0.8) },
                    u_maxOpacity: { value: opts.opacity || 0.85 }
                },
                vertexShader: dotVertShader, fragmentShader: dotFragShader,
                transparent: true, depthWrite: false
            }));
            globe.add(mesh);
            return mesh;
        }

        // --- LOD 0: Coastlines + fill (110m, always visible) ---
        // --- Ocean dots (blue-tinted) --- COMMENTED OUT, trying solid sphere instead
        // if (typeof OCEAN_POINTS !== 'undefined') {
        //     makePointsLayer(buildPointsFromFlat(OCEAN_POINTS, RADIUS),
        //         { size: 1.8, r: 0.25, g: 0.35, b: 0.55, opacity: 0.7 });
        // }

        var coastLod0 = null, fillLod0 = null;
        if (typeof COAST_GROUPS !== 'undefined') {
            coastLod0 = makePointsLayer(buildPointsFromGroups(COAST_GROUPS, RADIUS),
                { size: 2.5, r: 0.65, g: 0.65, b: 0.7, opacity: 0.45 });
        }
        if (typeof FILL_POINTS !== 'undefined') {
            fillLod0 = makePointsLayer(buildPointsFromFlat(FILL_POINTS, RADIUS),
                { size: 1.8, r: 0.5, g: 0.5, b: 0.55, opacity: 0.35 });
        }

        // --- LOD 1: HD coastlines + fill (50m, visible when zoomed in) ---
        var coastLod1 = null, fillLod1 = null;
        if (typeof COAST_GROUPS_HD !== 'undefined') {
            coastLod1 = makePointsLayer(buildPointsFromGroups(COAST_GROUPS_HD, RADIUS),
                { size: 2.0, r: 0.75, g: 0.75, b: 0.8, opacity: 0.85 });
            coastLod1.visible = false;
        }
        if (typeof FILL_POINTS_HD !== 'undefined') {
            fillLod1 = makePointsLayer(buildPointsFromFlat(FILL_POINTS_HD, RADIUS),
                { size: 1.5, r: 0.5, g: 0.5, b: 0.55, opacity: 0.35 });
            fillLod1.visible = false;
        }

        // --- Country borders (visible at all zoom levels) ---
        // Slightly warmer lilac tint to distinguish from cool-gray coastlines
        var borderLayer = null;
        if (typeof BORDER_GROUPS !== 'undefined') {
            borderLayer = makePointsLayer(buildPointsFromGroups(BORDER_GROUPS, RADIUS * 1.003),
                { size: 2.0, r: 0.72, g: 0.68, b: 0.82, opacity: 0.7 });
        }

        // --- State/province lines (visible when zoomed in) ---
        // Cooler blue-gray tint, reads as secondary structure
        var stateLayer = null;
        if (typeof STATE_GROUPS !== 'undefined') {
            stateLayer = makePointsLayer(buildPointsFromGroups(STATE_GROUPS, RADIUS * 1.002),
                { size: 1.6, r: 0.6, g: 0.62, b: 0.72, opacity: 0.52 });
            stateLayer.visible = false;
        }

        // LOD threshold — switch at midpoint between zoom-out and zoom-in
        var LOD_THRESHOLD = (viewSize + viewSize * 0.4) / 2;
        var currentLod = 0;

        // --- Hike dots (GREEN, per-vertex sizing) ---
        var hikePositions = [];
        var hikeSizes = [];
        var hikeGlowSizes = [];
        var hikeIdMap = [];

        if (typeof HIKE_DATA !== 'undefined') {
            HIKE_DATA.forEach(function (hike) {
                var v = latLngToVec3(hike.lat, hike.lng, RADIUS * 1.005);
                hikePositions.push(v.x, v.y, v.z);
                hikeSizes.push(5.5);
                hikeGlowSizes.push(16.0);
                hikeIdMap.push(hike.id);
            });
        }

        // Glow halo layer (rendered first, behind the dots)
        var glowGeo = new THREE.BufferGeometry();
        glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(hikePositions.slice(), 3));
        glowGeo.setAttribute('a_size', new THREE.Float32BufferAttribute(hikeGlowSizes, 1));
        var glowMat = new THREE.ShaderMaterial({
            uniforms: { u_color: { value: new THREE.Color(0.2, 0.85, 0.35) }, u_maxOpacity: { value: 0.25 } },
            vertexShader: hikeDotVertShader, fragmentShader: dotFragShader,
            transparent: true, depthWrite: false
        });
        globe.add(new THREE.Points(glowGeo, glowMat));

        // Solid hike dots (on top)
        var hikeGeo = new THREE.BufferGeometry();
        hikeGeo.setAttribute('position', new THREE.Float32BufferAttribute(hikePositions, 3));
        hikeGeo.setAttribute('a_size', new THREE.Float32BufferAttribute(hikeSizes, 1));
        var hikeMat = new THREE.ShaderMaterial({
            uniforms: { u_color: { value: new THREE.Color(0.25, 0.85, 0.35) }, u_maxOpacity: { value: 0.9 } },
            vertexShader: hikeDotVertShader, fragmentShader: dotFragShader,
            transparent: true, depthWrite: false
        });
        var hikePoints = new THREE.Points(hikeGeo, hikeMat);
        globe.add(hikePoints);

        // Full opacity values (for restoring after deactivation)
        var HIKE_DOT_OPACITY = 0.9;
        var HIKE_GLOW_OPACITY = 0.25;
        var HIKE_DOT_DIMMED = 0.7;
        var HIKE_GLOW_DIMMED = 0.05;

        // --- Active marker (BLUE accent, pulsing) ---
        var activeGeo = new THREE.BufferGeometry();
        activeGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
        var activeMat = new THREE.ShaderMaterial({
            uniforms: {
                u_baseSize: { value: 12.0 },
                u_color: { value: new THREE.Color(0.3, 1.0, 0.5) },
                u_maxOpacity: { value: 0.0 }
            },
            vertexShader: dotVertShader, fragmentShader: dotFragShader,
            transparent: true, depthWrite: false
        });
        globe.add(new THREE.Points(activeGeo, activeMat));

        // --- Background stars ---
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
            vertexShader: [
                'attribute float alpha;',
                'varying float v_alpha;',
                'void main() {',
                '    v_alpha = alpha;',
                '    gl_PointSize = alpha > 0.85 ? mix(1.8, 5.0, (alpha - 0.85) / 0.15) : 1.8;',
                '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'varying float v_alpha;',
                'void main() {',
                '    vec2 c = gl_PointCoord - vec2(0.5);',
                '    if (length(c) > 0.5) discard;',
                '    gl_FragColor = vec4(0.87, 0.87, 0.93, v_alpha);',
                '}'
            ].join('\n'),
            transparent: true, depthWrite: false
        });
        scene.add(new THREE.Points(starGeo, starMat));

        // --- State ---
        var targetRotY = null, targetRotX = null, idleSpeed = 0.002;
        var activeCity = null, pulsePhase = 0;
        var currentZoom = viewSize, targetZoom = viewSize;
        var ZOOM_IN = viewSize * 0.4, ZOOM_OUT = viewSize;
        var ZOOM_MIN = viewSize * 0.3, ZOOM_MAX = viewSize * 1.2;
        var leaveTimer = null;
        var animStart = performance.now();

        // --- User interaction state ---
        var isDragging = false;
        var dragStartX = 0, dragStartY = 0;
        var dragStartRotY = 0, dragStartRotX = 0;
        var userInteracting = false;
        var idleTimer = null;
        var IDLE_TIMEOUT = 5000;

        function startIdleTimer() {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(function () {
                userInteracting = false;
            }, IDLE_TIMEOUT);
        }

        // --- Mouse drag ---
        renderer.domElement.addEventListener('mousedown', function (e) {
            isDragging = true;
            userInteracting = true;
            if (idleTimer) clearTimeout(idleTimer);
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartRotY = globe.rotation.y;
            dragStartRotX = globe.rotation.x;
            renderer.domElement.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            var dx = e.clientX - dragStartX;
            var dy = e.clientY - dragStartY;
            var sensitivity = 0.005;
            globe.rotation.y = dragStartRotY - dx * sensitivity;
            globe.rotation.x = dragStartRotX - dy * sensitivity;
            // Clamp vertical rotation
            globe.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, globe.rotation.x));
            // Override any active targeting while dragging
            targetRotY = globe.rotation.y;
            targetRotX = globe.rotation.x;
        });

        window.addEventListener('mouseup', function () {
            if (isDragging) {
                isDragging = false;
                renderer.domElement.style.cursor = 'grab';
                startIdleTimer();
            }
        });

        // --- Touch drag ---
        renderer.domElement.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1) {
                isDragging = true;
                userInteracting = true;
                if (idleTimer) clearTimeout(idleTimer);
                dragStartX = e.touches[0].clientX;
                dragStartY = e.touches[0].clientY;
                dragStartRotY = globe.rotation.y;
                dragStartRotX = globe.rotation.x;
            }
        }, { passive: true });

        renderer.domElement.addEventListener('touchmove', function (e) {
            if (!isDragging || e.touches.length !== 1) return;
            var dx = e.touches[0].clientX - dragStartX;
            var dy = e.touches[0].clientY - dragStartY;
            var sensitivity = 0.005;
            globe.rotation.y = dragStartRotY - dx * sensitivity;
            globe.rotation.x = dragStartRotX - dy * sensitivity;
            globe.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, globe.rotation.x));
            targetRotY = globe.rotation.y;
            targetRotX = globe.rotation.x;
        }, { passive: true });

        renderer.domElement.addEventListener('touchend', function () {
            isDragging = false;
            startIdleTimer();
        }, { passive: true });

        // --- Scroll zoom ---
        renderer.domElement.addEventListener('wheel', function (e) {
            e.preventDefault();
            userInteracting = true;
            if (idleTimer) clearTimeout(idleTimer);
            var zoomDelta = e.deltaY * 0.001;
            targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZoom + zoomDelta));
            startIdleTimer();
        }, { passive: false });

        // Set default cursor
        renderer.domElement.style.cursor = 'grab';

        // --- Click raycasting ---
        // Plain Three.js raycaster — known to fire reliably. Threshold
        // 0.05 (down from the original 0.08) tightens the click area so
        // adjacent dots are less likely to be confused. Among intersects,
        // we skip back-hemisphere hits (back dots aren't occluded by the
        // solid sphere — only faded by the shader) and take the first
        // remaining candidate (closest to camera).
        var raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 0.05;
        var mouse = new THREE.Vector2();
        var clickStartX = 0, clickStartY = 0;
        var pickP = new THREE.Vector3();

        renderer.domElement.addEventListener('mousedown', function (e) {
            clickStartX = e.clientX;
            clickStartY = e.clientY;
        });

        renderer.domElement.addEventListener('click', function (e) {
            var dist = Math.abs(e.clientX - clickStartX) + Math.abs(e.clientY - clickStartY);
            if (dist > 5) return;
            var rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            var intersects = raycaster.intersectObject(hikePoints);
            if (!intersects.length) return;
            globe.updateMatrixWorld(true);
            for (var k = 0; k < intersects.length; k++) {
                var idx = intersects[k].index;
                pickP.fromBufferAttribute(hikeGeo.attributes.position, idx).applyMatrix4(globe.matrixWorld);
                // Front hemisphere: orthographic camera at +z looking down -z,
                // so visible side is world z > 0.
                if (pickP.z > 0 && idx < hikeIdMap.length && window.hikePageSelectHike) {
                    window.hikePageSelectHike(hikeIdMap[idx]);
                    return;
                }
            }
        });

        // --- Globe API ---
        function activateLocation(lat, lng, name) {
            if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
            // Override user interaction — hike selection takes priority
            userInteracting = false;
            isDragging = false;
            if (idleTimer) clearTimeout(idleTimer);

            targetRotY = lng * DEG;
            targetRotX = -lat * DEG;
            var v = latLngToVec3(lat, lng, RADIUS * 1.01);
            activeGeo.attributes.position.setXYZ(0, v.x, v.y, v.z);
            activeGeo.attributes.position.needsUpdate = true;
            activeMat.uniforms.u_maxOpacity.value = 1.0;
            activeCity = { lat: lat, lng: lng };
            targetZoom = ZOOM_IN;
            pulsePhase = 0;
            // Dim inactive hike dots so active marker stands out
            hikeMat.uniforms.u_maxOpacity.value = HIKE_DOT_DIMMED;
            glowMat.uniforms.u_maxOpacity.value = HIKE_GLOW_DIMMED;
            if (name) {
                label.textContent = name;
                label.style.opacity = '1';
            }
        }

        function deactivateLocation() {
            leaveTimer = setTimeout(function () {
                targetRotY = null;
                targetRotX = null;
                activeMat.uniforms.u_maxOpacity.value = 0.0;
                // Restore hike dot brightness
                hikeMat.uniforms.u_maxOpacity.value = HIKE_DOT_OPACITY;
                glowMat.uniforms.u_maxOpacity.value = HIKE_GLOW_OPACITY;
                activeCity = null;
                targetZoom = ZOOM_OUT;
                label.style.opacity = '0';
                leaveTimer = null;
            }, 300);
        }

        window.hikeGlobe = {
            activate: activateLocation,
            deactivate: deactivateLocation,
            highlight: function (hikeId) {
                for (var i = 0; i < HIKE_DATA.length; i++) {
                    if (HIKE_DATA[i].id === hikeId) {
                        activateLocation(HIKE_DATA[i].lat, HIKE_DATA[i].lng, HIKE_DATA[i].name);
                        return;
                    }
                }
            },
            clearHighlight: deactivateLocation
        };

        // --- Globe screen position for star culling ---
        var _sv = new THREE.Vector3();
        var _globeScreenPos = new THREE.Vector2();

        // --- Animation loop ---
        function animate() {
            requestAnimationFrame(animate);
            if (document.hidden) return;
            var t = (performance.now() - animStart) / 1000.0;

            if (isDragging) {
                // Rotation handled directly in mouse/touch handlers
            } else if (activeCity && !userInteracting) {
                // Lerp toward hike target
                var dy = targetRotY - globe.rotation.y;
                while (dy > Math.PI) dy -= Math.PI * 2;
                while (dy < -Math.PI) dy += Math.PI * 2;
                globe.rotation.y += dy * 0.04;
                if (targetRotX !== null) {
                    globe.rotation.x += (targetRotX - globe.rotation.x) * 0.04;
                }
                pulsePhase += 0.04;
                activeMat.uniforms.u_baseSize.value = 12.0 + Math.sin(pulsePhase) * 4.0;
                activeMat.uniforms.u_maxOpacity.value = 0.8 + Math.sin(pulsePhase) * 0.2;
            } else if (!userInteracting) {
                // Idle spin
                globe.rotation.y += idleSpeed;
                globe.rotation.x *= 0.98;
            } else {
                // User is interacting but not dragging — coast to a stop
                if (activeCity) {
                    pulsePhase += 0.04;
                    activeMat.uniforms.u_baseSize.value = 8.0 + Math.sin(pulsePhase) * 3.0;
                    activeMat.uniforms.u_maxOpacity.value = 0.8 + Math.sin(pulsePhase) * 0.2;
                }
            }

            // Smooth zoom
            currentZoom += (targetZoom - currentZoom) * 0.06;
            camera.left = -currentZoom * aspect;
            camera.right = currentZoom * aspect;
            camera.top = currentZoom;
            camera.bottom = -currentZoom;
            camera.updateProjectionMatrix();

            // LOD switching based on zoom level
            var newLod = currentZoom < LOD_THRESHOLD ? 1 : 0;
            if (newLod !== currentLod) {
                currentLod = newLod;
                if (coastLod0) coastLod0.visible = (newLod === 0);
                if (fillLod0) fillLod0.visible = (newLod === 0);
                if (coastLod1) coastLod1.visible = (newLod === 1);
                if (fillLod1) fillLod1.visible = (newLod === 1);
                if (stateLayer) stateLayer.visible = (newLod === 1);
            }

            // Star twinkling
            for (var si = 0; si < STAR_COUNT; si++) {
                var twinkle = 0.92 + 0.08 * Math.sin(t * (0.15 + si * 0.004) + si * 2.17);
                starBaseAlphas[si] = starAlphas[si] * twinkle;
                if (Math.random() < 0.000024) {
                    starBaseAlphas[si] = 1.0;
                }
            }

            // Globe screen position for star culling
            _sv.set(globe.position.x, 0, 0);
            _sv.project(camera);
            _globeScreenPos.set((_sv.x + 1) * 0.5 * W, (1 - _sv.y) * 0.5 * H);
            var screenR = (RADIUS / currentZoom) * H * 0.5 * 1.05;

            for (var si = 0; si < STAR_COUNT; si++) {
                _sv.set(starGeo.attributes.position.array[si * 3], starGeo.attributes.position.array[si * 3 + 1], -1.5);
                _sv.project(camera);
                _sv.x = (_sv.x + 1) * 0.5 * W;
                _sv.y = (1 - _sv.y) * 0.5 * H;
                var dx = _sv.x - _globeScreenPos.x;
                var dy2 = _sv.y - _globeScreenPos.y;
                if (dx * dx + dy2 * dy2 < screenR * screenR) {
                    starAlphaAttr.array[si] = 0;
                } else {
                    starAlphaAttr.array[si] = starBaseAlphas[si];
                }
            }
            starAlphaAttr.needsUpdate = true;

            renderer.render(scene, camera);
        }
        animate();
    } // end initGlobe
})();
