/* ============================================================
   3D MINESWEEPER — HERO MODEL VIEWER
   Lazy-loads minefield "models" and cycles between them with a
   crossfade. Currently uses procedural shapes (cube, octahedron,
   etc.) as placeholders — to swap in real GLTF assets, push an
   entry into MODELS with `{ id, label, src: '...glb' }` and the
   loader will use GLTFLoader instead of the procedural builder.
   ============================================================ */
(function () {
    var stage = document.getElementById('heroVisual');
    var label = document.getElementById('heroVisualLabel');
    if (!stage || typeof THREE === 'undefined') return;
    if (window.innerWidth < 600) return; // skip on tiny screens

    var W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) {
        // Try again next frame in case layout isn't ready
        requestAnimationFrame(arguments.callee);
        return;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    camera.position.set(0, 0, 9);
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    stage.appendChild(renderer.domElement);

    var root = new THREE.Group();
    scene.add(root);

    // Color palette
    var COL_HAZARD = new THREE.Color(0xff8a3c);
    var COL_REVEAL = new THREE.Color(0x4a9eff);
    var COL_DIM = new THREE.Color(0x2a2a3a);
    var COL_EDGE = new THREE.Color(0x6a6a85);

    // ── Procedural shape grid builder ─────────────────────────
    // Builds an N×N×N grid of `geometryFactory()` cells. Most
    // cells are dim; a few are tinted (revealed = blue, mine = amber).
    function buildGrid(geometryFactory, gridSize, cellScale) {
        var group = new THREE.Group();
        var n = gridSize;
        var spacing = 0.7 * cellScale;
        var halfRange = (n - 1) * 0.5;
        // Pre-build edge geometry once (shared across cells)
        var sample = geometryFactory();
        var edgeGeo = new THREE.EdgesGeometry(sample);
        sample.dispose();
        for (var x = 0; x < n; x++) {
            for (var y = 0; y < n; y++) {
                for (var z = 0; z < n; z++) {
                    var roll = Math.random();
                    var color, opacity;
                    if (roll < 0.05) { color = COL_HAZARD; opacity = 0.85; }
                    else if (roll < 0.13) { color = COL_REVEAL; opacity = 0.55; }
                    else { color = COL_DIM; opacity = 0.16; }
                    var geo = geometryFactory();
                    var mat = new THREE.MeshBasicMaterial({
                        color: color, transparent: true, opacity: opacity, depthWrite: false
                    });
                    var mesh = new THREE.Mesh(geo, mat);
                    var edgeMat = new THREE.LineBasicMaterial({
                        color: COL_EDGE, transparent: true,
                        opacity: opacity > 0.5 ? 0.9 : 0.35
                    });
                    mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
                    mesh.position.set(
                        (x - halfRange) * spacing,
                        (y - halfRange) * spacing,
                        (z - halfRange) * spacing
                    );
                    group.add(mesh);
                }
            }
        }
        return group;
    }

    // ── Model registry ────────────────────────────────────────
    // Each entry has a `build()` function returning a THREE.Object3D.
    // For a real GLTF model, write build = function(cb) { gltfLoader.load(src, cb); }
    // and adapt the loader path below.
    var MODELS = [
        { id: 'cube',         label: 'CUBE · 5³',         build: function () { return buildGrid(function () { return new THREE.BoxGeometry(0.4, 0.4, 0.4); },           5, 1.0); } },
        { id: 'octahedron',   label: 'OCTAHEDRON · 5³',   build: function () { return buildGrid(function () { return new THREE.OctahedronGeometry(0.30); },             5, 1.0); } },
        { id: 'tetrahedron',  label: 'TETRAHEDRON · 5³',  build: function () { return buildGrid(function () { return new THREE.TetrahedronGeometry(0.34); },            5, 1.05); } },
        { id: 'icosahedron',  label: 'ICOSAHEDRON · 5³',  build: function () { return buildGrid(function () { return new THREE.IcosahedronGeometry(0.30); },            5, 1.0); } },
        { id: 'dodecahedron', label: 'DODECAHEDRON · 5³', build: function () { return buildGrid(function () { return new THREE.DodecahedronGeometry(0.30); },           5, 1.0); } },
        { id: 'cube-7',       label: 'CUBE · 7³',         build: function () { return buildGrid(function () { return new THREE.BoxGeometry(0.32, 0.32, 0.32); },        7, 0.7); } }
    ];

    var current = null;
    var currentIdx = -1;
    var transitioning = false;
    var rotY = 0, rotX = 0;
    var DISPLAY_MS = 6500;
    var FADE_MS = 1200;

    function applyOpacity(group, factor) {
        group.traverse(function (obj) {
            if (obj.material && obj.material.transparent) {
                if (obj.material.userData._origOpacity == null) {
                    obj.material.userData._origOpacity = obj.material.opacity;
                }
                obj.material.opacity = obj.material.userData._origOpacity * factor;
            }
        });
    }

    function disposeGroup(group) {
        group.traverse(function (obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(function (m) { m.dispose(); });
                else obj.material.dispose();
            }
        });
    }

    function showModel(idx) {
        if (transitioning || idx === currentIdx) return;
        transitioning = true;
        var entry = MODELS[idx];
        if (label) label.textContent = '[ LOADING ' + entry.label + ' ]';
        // Build asynchronously to keep the main thread responsive
        requestAnimationFrame(function () {
            var newGroup = entry.build();
            newGroup.scale.set(0.55, 0.55, 0.55);
            applyOpacity(newGroup, 0);
            root.add(newGroup);

            var t0 = performance.now();
            (function fade() {
                var t = Math.min(1, (performance.now() - t0) / FADE_MS);
                applyOpacity(newGroup, t);
                if (current) applyOpacity(current, 1 - t);
                if (t < 1) { requestAnimationFrame(fade); return; }
                if (current) { root.remove(current); disposeGroup(current); }
                current = newGroup;
                currentIdx = idx;
                transitioning = false;
                if (label) label.textContent = '[ ' + entry.label + ' ]';
            })();
        });
    }

    function cycle() {
        showModel((currentIdx + 1) % MODELS.length);
    }
    showModel(0);
    setInterval(cycle, DISPLAY_MS);

    // Animation loop
    var lastT = performance.now();
    function animate() {
        requestAnimationFrame(animate);
        if (document.hidden) { lastT = performance.now(); return; }
        var now = performance.now();
        var dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;
        rotY += dt * 0.18;
        rotX = Math.sin(now * 0.00012) * 0.25;
        root.rotation.y = rotY;
        root.rotation.x = rotX;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function () {
        var w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    });
})();
