/* ============================================================
   INDEX PAGE LOGIC — age ticker, raw→live transition
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
    const content = document.getElementById('content');
    const language = initCommon();

    // --- Age ticker ---
    const ageEl = document.getElementById('ageTicker');
    let lastUpdate = 0;
    const interval = 30; //ms
    function updateAge(timestamp) {
        requestAnimationFrame(updateAge);
        if (document.hidden) return;
        if (timestamp - lastUpdate >= interval) {
            ageEl.textContent = ((Date.now() - 795794400000) / 31556908800).toFixed(20);
            lastUpdate = timestamp;
        }
    }
    requestAnimationFrame(updateAge);

    // --- Raw → Live transition ---
    setTimeout(function () {
        document.querySelectorAll('.text').forEach(function (el) {
            glitchText(el, language);
        });
    }, 200);

    setTimeout(function () {
        content.classList.remove('state-raw');
        content.classList.add('state-live');
    }, 1200);

});

/* ============================================================
   WIREFRAME POLYHEDRA PARTICLE FIELD
   ============================================================ */
(function () {
    1
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.getElementById('particle-canvas');
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
    if (!gl) return;

    let width, height, dpr;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    /* ---- OBJ Loader: fetch and parse .obj files at runtime ---- */
    var OBJ_DIR = '../../static/www/models/';
    var OBJ_FILES = [
        'Cube.obj',
        'ElongatedDodecahedron.obj',
        'HexagonalPrism.obj',
        'TriangularPrism.obj',
        'Octakaideca Plesiohedron.obj'
    ];

    function parseOBJ(text) {
        var v = [], f = [];
        text.split('\n').forEach(function (line) {
            line = line.trim();
            if (line.startsWith('v ')) {
                var parts = line.split(/\s+/);
                v.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (line.startsWith('f ')) {
                var parts = line.split(/\s+/).slice(1);
                var face = parts.map(function (p) { return parseInt(p.split('/')[0]); });
                f.push(face);
            }
        });
        return { v: v, f: f };
    }

    function loadAllModels(callback) {
        var models = {};
        var loaded = 0;
        OBJ_FILES.forEach(function (file) {
            fetch(OBJ_DIR + file)
                .then(function (r) { return r.text(); })
                .then(function (text) {
                    var name = file.replace('.obj', '').replace(/\s+/g, '_').toLowerCase();
                    models[name] = parseOBJ(text);
                    loaded++;
                    if (loaded === OBJ_FILES.length) callback(models);
                })
                .catch(function (err) {
                    console.warn('Failed to load ' + file + ':', err);
                    loaded++;
                    if (loaded === OBJ_FILES.length) callback(models);
                });
        });
    }

    loadAllModels(function (models) {

        /* ---- Pre-compute face normals for each model (for SAT collision) ---- */
        function computeFaceNormals(verts, faces) {
            const normals = [];
            faces.forEach(function (face) {
                const v0 = verts[face[0] - 1];
                const v1 = verts[face[1] - 1];
                const v2 = verts[face[2] - 1];
                const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
                const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
                const n = [
                    e1[1] * e2[2] - e1[2] * e2[1],
                    e1[2] * e2[0] - e1[0] * e2[2],
                    e1[0] * e2[1] - e1[1] * e2[0]
                ];
                const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
                if (len > 0.0001) {
                    normals.push([n[0] / len, n[1] / len, n[2] / len]);
                }
            });
            return normals;
        }

        Object.keys(models).forEach(function (key) {
            const m = models[key];
            m.normals = computeFaceNormals(m.v, m.f);
        });

        /* ---- Extract unique edges from faces ---- */
        function getEdges(faces) {
            const edgeSet = new Set();
            const edges = [];
            faces.forEach(function (face) {
                for (let i = 0; i < face.length; i++) {
                    const a = face[i], b = face[(i + 1) % face.length];
                    const key = Math.min(a, b) + ',' + Math.max(a, b);
                    if (!edgeSet.has(key)) {
                        edgeSet.add(key);
                        edges.push([a - 1, b - 1]);
                    }
                }
            });
            return edges;
        }

        /* ---- Distribute points along edges with uniform spacing ---- */
        function sampleEdges(verts, edges, spacing) {
            const points = [];
            edges.forEach(function (e) {
                const a = verts[e[0]], b = verts[e[1]];
                const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
                const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const count = Math.max(2, Math.round(len / spacing));
                for (let i = 0; i <= count; i++) {
                    const t = i / count;
                    points.push(
                        a[0] + dx * t,
                        a[1] + dy * t,
                        a[2] + dz * t
                    );
                }
            });
            return new Float32Array(points);
        }

        /* ---- Build shape instances scattered across the screen ---- */
        const shapeKeys = Object.keys(models);
        const instances = [];
        const POINT_SPACING = isMobile ? 0.18 : 0.1;
        const NUM_SHAPES = isMobile ? OBJ_FILES.length : 2 * OBJ_FILES.length;

        const placements = [];
        for (var pi = 0; pi < NUM_SHAPES; pi++) {
            var shape = shapeKeys[pi % shapeKeys.length];
            placements.push({
                shape: shape,
                x: (Math.random() * 2 - 1) * 0.8,
                y: (Math.random() * 2 - 1) * 0.7,
                z: 0,
                scale: 0.10 + Math.random() * 0.08,
                rotSpeed: [
                    0.02 + Math.random() * 0.08,
                    0.02 + Math.random() * 0.08,
                    0.02 + Math.random() * 0.08
                ]
            });
        }

        placements.forEach(function (p) {
            const m = models[p.shape];
            const edges = getEdges(m.f);
            const pts = sampleEdges(m.v, edges, POINT_SPACING);
            let maxR = 0;
            m.v.forEach(function (v) {
                const r = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
                if (r > maxR) maxR = r;
            });
            instances.push({
                basePoints: pts,
                count: pts.length / 3,
                modelVerts: m.v,
                modelNormals: m.normals,
                x: p.x, y: p.y, z: p.z,
                vx: (Math.random() - 0.5) * 0.002,
                vy: (Math.random() - 0.5) * 0.002,
                vz: (Math.random() - 0.5) * 0.001,
                scale: p.scale,
                radius: maxR * p.scale,
                mass: p.scale * p.scale * p.scale,
                rotSpeed: p.rotSpeed,
                rotOffset: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28]
            });
        });

        /* ---- Simple shader: takes pre-transformed 2D positions ---- */
        const vertSrc = `#version 300 es
precision highp float;
in vec2 a_position;
in float a_alpha;
out float v_alpha;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    gl_PointSize = mix(1.5, 3.0, a_alpha);
    v_alpha = a_alpha;
}`;

        const fragSrc = `#version 300 es
precision highp float;
in float v_alpha;
out vec4 fragColor;
void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.2, d);
    fragColor = vec4(0.65, 0.65, 0.7, v_alpha * edge);
}`;

        function createShader(type, src) {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(s));
                return null;
            }
            return s;
        }

        const vs = createShader(gl.VERTEX_SHADER, vertSrc);
        const fs = createShader(gl.FRAGMENT_SHADER, fragSrc);
        if (!vs || !fs) return;

        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(prog));
            return;
        }
        gl.useProgram(prog);

        const aPos = gl.getAttribLocation(prog, 'a_position');
        const aAlpha = gl.getAttribLocation(prog, 'a_alpha');

        /* ---- Ambient background particles ---- */
        const BG_COUNT = isMobile ? 800 : 2000;
        const bgParticles = [];
        for (let i = 0; i < BG_COUNT; i++) {
            bgParticles.push({
                x: Math.random() * 2.6 - 1.3,
                y: Math.random() * 2.6 - 1.3,
                vx: (Math.random() - 0.5) * 0.0008,
                vy: (Math.random() - 0.5) * 0.0006,
                alpha: 0.35 + Math.random() * 0.3
            });
        }

        let totalPoints = 0;
        instances.forEach(function (inst) { totalPoints += inst.count; });
        totalPoints += BG_COUNT;

        const posBuf = gl.createBuffer();
        const alphaBuf = gl.createBuffer();
        const posData = new Float32Array(totalPoints * 2);
        const alphaData = new Float32Array(totalPoints);

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, posData.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuf);
        gl.bufferData(gl.ARRAY_BUFFER, alphaData.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aAlpha);
        gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, 0, 0);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        /* ---- Rotation helpers ---- */
        function rotX(p, a) {
            const c = Math.cos(a), s = Math.sin(a);
            return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
        }
        function rotY(p, a) {
            const c = Math.cos(a), s = Math.sin(a);
            return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
        }
        function rotZ(p, a) {
            const c = Math.cos(a), s = Math.sin(a);
            return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
        }

        /* ---- SAT collision helpers ---- */
        function transformVert(v, rx, ry, rz, scale, pos) {
            let p = [v[0], v[1], v[2]];
            p = rotX(p, rx); p = rotY(p, ry); p = rotZ(p, rz);
            return [p[0] * scale + pos[0], p[1] * scale + pos[1], p[2] * scale + pos[2]];
        }

        function transformNormal(n, rx, ry, rz) {
            let p = [n[0], n[1], n[2]];
            p = rotX(p, rx); p = rotY(p, ry); p = rotZ(p, rz);
            return p;
        }

        function projectOnAxis(verts, axis) {
            let min = Infinity, max = -Infinity;
            for (let i = 0; i < verts.length; i++) {
                const d = verts[i][0] * axis[0] + verts[i][1] * axis[1] + verts[i][2] * axis[2];
                if (d < min) min = d;
                if (d > max) max = d;
            }
            return [min, max];
        }

        function satTest(vertsA, normalsA, vertsB, normalsB) {
            let minDepth = Infinity;
            let minNormal = null;

            const allAxes = normalsA.concat(normalsB);
            for (let i = 0; i < allAxes.length; i++) {
                const axis = allAxes[i];
                const projA = projectOnAxis(vertsA, axis);
                const projB = projectOnAxis(vertsB, axis);

                const overlap = Math.min(projA[1] - projB[0], projB[1] - projA[0]);
                if (overlap <= 0) return null;

                if (overlap < minDepth) {
                    minDepth = overlap;
                    const centerA = (projA[0] + projA[1]) / 2;
                    const centerB = (projB[0] + projB[1]) / 2;
                    if (centerB > centerA) {
                        minNormal = [axis[0], axis[1], axis[2]];
                    } else {
                        minNormal = [-axis[0], -axis[1], -axis[2]];
                    }
                }
            }

            return { depth: minDepth, normal: minNormal };
        }

        const frameCache = [];

        function getWorldData(inst, t) {
            const rx = inst.rotOffset[0] + t * inst.rotSpeed[0];
            const ry = inst.rotOffset[1] + t * inst.rotSpeed[1];
            const rz = inst.rotOffset[2] + t * inst.rotSpeed[2];
            const pos = [inst.x, inst.y, inst.z];
            const wVerts = inst.modelVerts.map(function (v) {
                return transformVert(v, rx, ry, rz, inst.scale, pos);
            });
            const wNormals = inst.modelNormals.map(function (n) {
                return transformNormal(n, rx, ry, rz);
            });
            return { verts: wVerts, normals: wNormals };
        }

        const startTime = performance.now();
        let lastTime = startTime;

        const WALL_X = 1.3;
        const WALL_Y = 1.3;
        const WALL_Z = 0.06;
        const MAX_SPEED = 0.0018;

        function render() {
            requestAnimationFrame(render);
            if (document.hidden) return;
            const now = performance.now();
            const t = (now - startTime) / 1000.0;
            const dt = Math.min((now - lastTime) / 1000.0, 0.05);
            lastTime = now;
            const aspect = width / height;

            // --- Physics: update positions ---
            instances.forEach(function (inst) {
                inst.x += inst.vx * dt * 60;
                inst.y += inst.vy * dt * 60;
                inst.z += inst.vz * dt * 60;

                if (inst.x > WALL_X) { inst.x = WALL_X; inst.vx *= -1; }
                if (inst.x < -WALL_X) { inst.x = -WALL_X; inst.vx *= -1; }
                if (inst.y > WALL_Y) { inst.y = WALL_Y; inst.vy *= -1; }
                if (inst.y < -WALL_Y) { inst.y = -WALL_Y; inst.vy *= -1; }
                if (inst.z > WALL_Z) { inst.z = WALL_Z; inst.vz *= -1; }
                if (inst.z < -WALL_Z) { inst.z = -WALL_Z; inst.vz *= -1; }

                const speed = Math.sqrt(inst.vx * inst.vx + inst.vy * inst.vy + inst.vz * inst.vz);
                if (speed > MAX_SPEED) {
                    const s = MAX_SPEED / speed;
                    inst.vx *= s; inst.vy *= s; inst.vz *= s;
                }
            });

            // --- Shape-shape collisions (SAT on actual convex geometry) ---
            for (let i = 0; i < instances.length; i++) {
                frameCache[i] = getWorldData(instances[i], t);
            }

            for (let a = 0; a < instances.length; a++) {
                for (let b = a + 1; b < instances.length; b++) {
                    const ia = instances[a], ib = instances[b];

                    const dx = ib.x - ia.x, dy = ib.y - ia.y, dz = ib.z - ia.z;
                    const distSq = dx * dx + dy * dy + dz * dz;
                    const rSum = ia.radius + ib.radius;
                    if (distSq > rSum * rSum) continue;

                    const cA = frameCache[a], cB = frameCache[b];
                    const result = satTest(cA.verts, cA.normals, cB.verts, cB.normals);
                    if (!result) continue;

                    const n = result.normal;
                    const depth = result.depth;

                    const sep = depth / 2 + 0.001;
                    ia.x -= n[0] * sep;
                    ia.y -= n[1] * sep;
                    ia.z -= n[2] * sep;
                    ib.x += n[0] * sep;
                    ib.y += n[1] * sep;
                    ib.z += n[2] * sep;

                    const totalMass = ia.mass + ib.mass;
                    const dvx = ia.vx - ib.vx;
                    const dvy = ia.vy - ib.vy;
                    const dvz = ia.vz - ib.vz;
                    const dot = dvx * n[0] + dvy * n[1] + dvz * n[2];

                    if (dot > 0) {
                        const impulseA = 2 * ib.mass / totalMass * dot;
                        const impulseB = 2 * ia.mass / totalMass * dot;

                        ia.vx -= impulseA * n[0];
                        ia.vy -= impulseA * n[1];
                        ia.vz -= impulseA * n[2];
                        ib.vx += impulseB * n[0];
                        ib.vy += impulseB * n[1];
                        ib.vz += impulseB * n[2];
                    }
                }
            }

            // --- Render shapes ---
            let offset = 0;
            instances.forEach(function (inst) {
                const rx = inst.rotOffset[0] + t * inst.rotSpeed[0];
                const ry = inst.rotOffset[1] + t * inst.rotSpeed[1];
                const rz = inst.rotOffset[2] + t * inst.rotSpeed[2];

                for (let i = 0; i < inst.count; i++) {
                    let p = [
                        inst.basePoints[i * 3],
                        inst.basePoints[i * 3 + 1],
                        inst.basePoints[i * 3 + 2]
                    ];

                    p = rotX(p, rx);
                    p = rotY(p, ry);
                    p = rotZ(p, rz);

                    const sx = (p[0] * inst.scale + inst.x) / (aspect > 1 ? 1 : aspect);
                    const sy = (p[1] * inst.scale + inst.y) * (aspect > 1 ? aspect : 1);

                    posData[(offset + i) * 2] = sx;
                    posData[(offset + i) * 2 + 1] = sy;

                    const depth = (p[2] * inst.scale + 1.0) / 2.0;
                    alphaData[offset + i] = 0.4 + depth * 0.5;
                }
                offset += inst.count;
            });

            // Background ambient particles
            for (let i = 0; i < BG_COUNT; i++) {
                const bp = bgParticles[i];
                bp.x += bp.vx;
                bp.y += bp.vy;
                if (bp.x > 1.3) bp.x = -1.3;
                if (bp.x < -1.3) bp.x = 1.3;
                if (bp.y > 1.3) bp.y = -1.3;
                if (bp.y < -1.3) bp.y = 1.3;

                posData[(offset + i) * 2] = bp.x / (aspect > 1 ? 1 : aspect);
                posData[(offset + i) * 2 + 1] = bp.y * (aspect > 1 ? aspect : 1);
                alphaData[offset + i] = bp.alpha;
            }

            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, posData);
            gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuf);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, alphaData);

            gl.drawArrays(gl.POINTS, 0, totalPoints);
        }

        render();
    }); // end loadAllModels callback
})();