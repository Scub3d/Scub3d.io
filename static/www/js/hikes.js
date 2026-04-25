/* ============================================================
   HIKES PAGE — Mapbox 3D terrain viewer + globe sync
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
    var language = initCommon();

    var content = document.getElementById('content');
    var hikeDetails = document.getElementById('hikeDetails');
    var hikeDetailName = document.getElementById('hikeDetailName');
    var hikeDetailGrid = document.getElementById('hikeDetailGrid');
    var hikeDetailLinks = document.getElementById('hikeDetailLinks');
    var terrainViewport = document.getElementById('terrainViewport');
    var hikeList = document.getElementById('hikeList');
    var activeHikeId = null;
    var map = null;

    // --- Unit conversion ---
    function miToKm(val) {
        var s = String(val);
        var m = s.match(/([\d.]+)/);
        return m ? (parseFloat(m[1]) * 1.60934).toFixed(1) + ' km' : s;
    }
    function ftToM(val) {
        var s = String(val);
        var m = s.match(/([\d,]+)/);
        return m ? Math.round(parseFloat(m[1].replace(/,/g, '')) * 0.3048).toLocaleString() + ' m' : s;
    }
    function fmtDist(h) {
        return h.distance ? (language === 'japanese' ? miToKm(h.distance) : h.distance) : '';
    }
    function fmtElev(h) {
        return h.elevation ? (language === 'japanese' ? ftToM(h.elevation) : h.elevation) : '';
    }

    // --- Build hike list (grouped by state) ---
    var STATE_NAMES = {
        'WA': 'Washington', 'OR': 'Oregon', 'CA': 'California', 'MT': 'Montana',
        'WY': 'Wyoming', 'UT': 'Utah', 'AZ': 'Arizona', 'HI': 'Hawaii',
        'BC': 'British Columbia'
    };
    function getState(h) {
        var m = h.location.match(/,\s*(\S+)$/);
        return m ? m[1] : h.location;
    }
    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // Build a .text wrapper so initCommon's translate handler glitches it.
    function textSpan(cls, en, jp, current) {
        return '<span class="' + cls + ' text">'
            + '<span class="englishText">' + esc(en) + '</span>'
            + '<span class="japaneseText">' + esc(jp) + '</span>'
            + '<span class="displayText">' + esc(current) + '</span>'
            + '</span>';
    }
    function buildHikeList() {
        var html = '';
        var lastState = '';
        for (var i = 0; i < HIKE_DATA.length; i++) {
            var h = HIKE_DATA[i];
            var state = getState(h);
            if (state !== lastState) {
                var label = STATE_NAMES[state] || state;
                html += '<div class="hike-list-state">' + esc(label) + '</div>';
                lastState = state;
            }
            html += '<div class="hike-list-item" data-hike-id="' + esc(h.id) + '">';
            var enName = h.name;
            var jpName = h.nameJp || h.name;
            var curName = language === 'japanese' ? jpName : enName;
            html += textSpan('hike-list-item-name', enName, jpName, curName);
            if (h.distance) {
                var enDist = h.distance;
                var jpDist = miToKm(h.distance);
                var curDist = language === 'japanese' ? jpDist : enDist;
                html += textSpan('hike-list-item-dist', enDist, jpDist, curDist);
            }
            html += '</div>';
        }
        hikeList.innerHTML = html;
        // Re-highlight active hike
        if (activeHikeId) {
            var items = hikeList.querySelectorAll('.hike-list-item');
            for (var j = 0; j < items.length; j++) {
                if (items[j].getAttribute('data-hike-id') === activeHikeId) items[j].classList.add('active');
            }
        }
    }

    buildHikeList();

    // Sync the local `language` state with the cookie after initCommon
    // toggles it. The hike list and detail panel are .text-wrapped, so
    // initCommon's translate listener will glitch them — no need to
    // re-render the DOM here.
    document.querySelectorAll('.js-translate').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var c = document.cookie.match(/language=(\w+)/);
            language = c ? c[1] : language;
        });
    });

    hikeList.addEventListener('click', function (e) {
        var item = e.target.closest('.hike-list-item');
        if (item && item.getAttribute('data-hike-id')) {
            selectHike(item.getAttribute('data-hike-id'));
        }
    });

    // --- Update trail count ---
    var countEl = document.getElementById('hikeCount');
    if (countEl) {
        var enSpan = countEl.querySelector('.englishText');
        var jpSpan = countEl.querySelector('.japaneseText');
        var dispSpan = countEl.querySelector('.displayText');
        if (enSpan) enSpan.textContent = '[' + HIKE_DATA.length + ' TRAILS]';
        if (jpSpan) jpSpan.textContent = '[' + HIKE_DATA.length + ' トレイル]';
        if (dispSpan) dispSpan.textContent = language === 'japanese' ? jpSpan.textContent : enSpan.textContent;
    }

    // --- Initialize Mapbox ---
    mapboxgl.accessToken = 'pk.eyJ1Ijoic2N1YjNkIiwiYSI6ImNsN3BudXVsNTJuazk0MG9mdnBoejM0aWkifQ.UDXSIh11mtNj2h-hY6GQHg';

    // --- Slow orbit ---
    var orbitActive = false;
    var orbitRAF = null;
    var ORBIT_SPEED = 0.04; // degrees per frame (~2.4°/sec at 60fps, full rotation in ~2.5 min)

    // Flight tracking — simple timeout for post-flight orbit
    var flightTimer = null;
    var FLIGHT_DURATION = 2500;

    function startOrbit() {
        stopOrbit();
        orbitActive = true;
        function step() {
            if (!orbitActive || !map) return;
            map.setBearing(map.getBearing() + ORBIT_SPEED);
            orbitRAF = requestAnimationFrame(step);
        }
        orbitRAF = requestAnimationFrame(step);
    }

    function stopOrbit() {
        orbitActive = false;
        if (orbitRAF) {
            cancelAnimationFrame(orbitRAF);
            orbitRAF = null;
        }
    }

    // Lazy-load trail data per trail
    var trailCache = {};
    var loadingTrails = {};
    function loadTrail(id, cb) {
        if (trailCache[id]) { cb(); return; }
        if (loadingTrails[id]) { loadingTrails[id].push(cb); return; }
        loadingTrails[id] = [cb];
        var url = '../../static/www/data/trails/' + id + '.json';
        fetch(url).then(function (r) { return r.json(); }).then(function (data) {
            trailCache[id] = data;
            var cbs = loadingTrails[id];
            delete loadingTrails[id];
            cbs.forEach(function (fn) { fn(); });
        }).catch(function () {
            delete loadingTrails[id];
        });
    }
    function getTrail(hike) {
        if (hike.trail) return hike.trail;
        if (trailCache[hike.id]) return trailCache[hike.id];
        return null;
    }

    // Compute padded bounding box from trail coordinates or hike center
    var BOUNDS_PAD = 0.145; // ~10 miles of padding around trail bounds
    function getHikeBounds(hike) {
        var minLng, maxLng, minLat, maxLat;
        var trail = getTrail(hike);
        if (trail && trail.length > 0) {
            // Flatten multi-segment trails for bounds
            var isMulti = Array.isArray(trail[0]) && Array.isArray(trail[0][0]);
            var allPts = isMulti ? [].concat.apply([], trail) : trail;
            minLng = maxLng = allPts[0][0];
            minLat = maxLat = allPts[0][1];
            for (var i = 1; i < allPts.length; i++) {
                var p = allPts[i];
                if (p[0] < minLng) minLng = p[0];
                if (p[0] > maxLng) maxLng = p[0];
                if (p[1] < minLat) minLat = p[1];
                if (p[1] > maxLat) maxLat = p[1];
            }
        } else {
            minLng = maxLng = hike.lng;
            minLat = maxLat = hike.lat;
        }
        return [
            [minLng - BOUNDS_PAD, minLat - BOUNDS_PAD],
            [maxLng + BOUNDS_PAD, maxLat + BOUNDS_PAD]
        ];
    }

    function initMap() {
        map = new mapboxgl.Map({
            container: 'terrainViewport',
            style: 'mapbox://styles/scub3d/cmnz20hv1003601rg4ek7hekk',
            center: [-121.7, 47.45],
            zoom: 10,
            pitch: 60,
            bearing: -20,
            antialias: true,
            minZoom: 6,
            maxZoom: 15
        });

        map.on('style.load', function () {
            // Override terrain exaggeration — the custom style drops to 0
            // at zoom 13.7, but we fly to zoom 13 for hike close-ups.
            if (!map.getSource('mapbox-dem')) {
                map.addSource('mapbox-dem', {
                    type: 'raster-dem',
                    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    tileSize: 512,
                    maxzoom: 14
                });
            }
            map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.0 });

            // Reduce map clutter — hide POIs, minor roads, buildings
            // Keep: national parks, wilderness, mountains, water labels,
            //       major cities, highways, islands
            var layers = map.getStyle().layers;
            var hidePatterns = [
                'contour',          // contour lines
                'building',         // buildings
                'transit',          // transit lines/stations
                'ferry',            // ferry routes
                'golf',             // golf courses
                'cemetery',         // cemeteries
                'industrial',       // industrial areas
                'commercial',       // commercial areas
                'parking',          // parking lots
                'airport',          // airport areas (keep if you want)
            ];
            var hidePoi = [
                'hospital', 'doctor', 'pharmacy', 'dentist',
                'school', 'college', 'university',
                'police', 'fire-station', 'post',
                'bank', 'atm',
                'restaurant', 'cafe', 'bar', 'fast-food',
                'shop', 'store', 'mall', 'marketplace',
                'fuel', 'car', 'bus', 'rail',
                'hotel', 'lodging', 'motel',
                'office', 'government', 'town-hall', 'embassy',
                'library', 'museum', 'theater', 'cinema',
                'fitness', 'swimming', 'stadium', 'sports',
                'place-of-worship', 'religious',
                'information', 'toilet', 'telephone',
                'veterinary', 'laundry', 'waste',
            ];
            for (var i = 0; i < layers.length; i++) {
                var id = layers[i].id.toLowerCase();

                // Hide matching layer patterns
                var shouldHide = false;
                for (var j = 0; j < hidePatterns.length; j++) {
                    if (id.indexOf(hidePatterns[j]) !== -1) { shouldHide = true; break; }
                }
                if (shouldHide) {
                    map.setLayoutProperty(layers[i].id, 'visibility', 'none');
                    continue;
                }

                // Hide minor/local roads but keep highways
                if (layers[i].type === 'line' && (
                    id.indexOf('street') !== -1 ||
                    id.indexOf('pedestrian') !== -1 ||
                    id.indexOf('service') !== -1 ||
                    id.indexOf('track') !== -1 ||
                    id.indexOf('path') !== -1 ||
                    id.indexOf('steps') !== -1 ||
                    id.indexOf('cycleway') !== -1 ||
                    id.indexOf('road-minor') !== -1 ||
                    id.indexOf('road-local') !== -1
                )) {
                    map.setLayoutProperty(layers[i].id, 'visibility', 'none');
                    continue;
                }
            }

            // Hide POI labels via Mapbox Standard config (if available)
            try {
                map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
                map.setConfigProperty('basemap', 'showTransitLabels', false);
            } catch (e) {
                // Fallback: hide POI symbol layers manually
                for (var k = 0; k < layers.length; k++) {
                    if (layers[k].type === 'symbol') {
                        var sid = layers[k].id.toLowerCase();
                        if (sid.indexOf('poi') !== -1) {
                            map.setLayoutProperty(layers[k].id, 'visibility', 'none');
                        }
                    }
                }
            }

            // Trail source
            if (!map.getSource('trail')) {
                map.addSource('trail', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            // Trail outline for depth
            if (!map.getLayer('trail-outline')) {
                map.addLayer({
                    id: 'trail-outline',
                    type: 'line',
                    source: 'trail',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#000000', 'line-width': 6, 'line-opacity': 0.4, 'line-emissive-strength': 1 }
                });
            }

            // Trail line
            if (!map.getLayer('trail-line')) {
                map.addLayer({
                    id: 'trail-line',
                    type: 'line',
                    source: 'trail',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#4a9eff', 'line-width': 3, 'line-opacity': 1.0, 'line-emissive-strength': 1 }
                });
            }

            // Stop orbit when user interacts with map
            map.on('mousedown', stopOrbit);
            map.on('touchstart', stopOrbit);

            // Auto-load first hike
            if (HIKE_DATA.length > 0 && !activeHikeId) {
                selectHike(HIKE_DATA[0].id);
            }
        });
    }

    // --- Select a hike ---
    function selectHike(hikeId) {
        var hike = null;
        for (var i = 0; i < HIKE_DATA.length; i++) {
            if (HIKE_DATA[i].id === hikeId) { hike = HIKE_DATA[i]; break; }
        }
        if (!hike) return;

        activeHikeId = hikeId;

        // Update hike list active state
        var items = hikeList.querySelectorAll('.hike-list-item');
        for (var j = 0; j < items.length; j++) {
            if (items[j].getAttribute('data-hike-id') === hikeId) {
                items[j].classList.add('active');
            } else {
                items[j].classList.remove('active');
            }
        }

        // Update hike details panel — wrap each cell in .text so the
        // language toggle's glitch animation picks them up.
        var enName = hike.name;
        var jpName = hike.nameJp || hike.name;
        var curName = language === 'japanese' ? jpName : enName;
        hikeDetailName.innerHTML = textSpan('hike-detail-name-text', enName, jpName, curName);

        var gridHtml = '';
        if (hike.location) {
            var enLoc = hike.location;
            var jpLoc = hike.locationJp || hike.location;
            var curLoc = language === 'japanese' ? jpLoc : enLoc;
            gridHtml += textSpan('hike-detail-label', 'location', '場所', language === 'japanese' ? '場所' : 'location');
            gridHtml += textSpan('hike-detail-value', enLoc, jpLoc, curLoc);
        }
        if (hike.distance) {
            var enDist2 = hike.distance;
            var jpDist2 = miToKm(hike.distance);
            var curDist2 = language === 'japanese' ? jpDist2 : enDist2;
            gridHtml += textSpan('hike-detail-label', 'dist', '距離', language === 'japanese' ? '距離' : 'dist');
            gridHtml += textSpan('hike-detail-value', enDist2, jpDist2, curDist2);
        }
        if (hike.elevation) {
            var enElev = hike.elevation;
            var jpElev = ftToM(hike.elevation);
            var curElev = language === 'japanese' ? jpElev : enElev;
            gridHtml += textSpan('hike-detail-label', 'elev', '標高差', language === 'japanese' ? '標高差' : 'elev');
            gridHtml += textSpan('hike-detail-value', enElev, jpElev, curElev);
        }
        hikeDetailGrid.innerHTML = gridHtml;

        var linksHtml = '';
        if (hike.alltrails) {
            linksHtml += '<a href="' + hike.alltrails + '" target="_blank" class="hike-detail-link">[AllTrails &#8599;]</a>';
        }
        hikeDetailLinks.innerHTML = linksHtml;

        hikeDetails.classList.add('visible');

        // Fly to location on map
        if (map) {
            stopOrbit();
            if (flightTimer) clearTimeout(flightTimer);

            // Unlock constraints for flight
            map.setMaxBounds(null);
            map.setMinZoom(6);

            // Adapt flight arc to distance — short hops stay tight, long trips zoom out
            var center = map.getCenter();
            var dlat = hike.lat - center.lat;
            var dlng = hike.lng - center.lng;
            var dist = Math.sqrt(dlat * dlat + dlng * dlng); // degrees

            var curve, minZ, dur;
            if (dist < 0.15) {
                curve = 1.0;
                minZ = 11;
                dur = 1800;
            } else if (dist < 0.8) {
                curve = 1.2;
                minZ = 10;
                dur = 2500;
            } else if (dist < 2) {
                curve = 1.5;
                minZ = 8;
                dur = 3500;
            } else {
                curve = 1.8;
                minZ = 6;
                dur = 4500;
            }

            // Zoom out a little further on mobile so the whole trail
            // fits comfortably inside the narrower viewport.
            var isMobile = window.innerWidth <= 768;
            var targetZoom = isMobile ? 11 : 12;
            var minZoomLock = isMobile ? 8 : 9;

            var hikeBounds = getHikeBounds(hike);
            flightTimer = setTimeout(function () {
                map.setMaxBounds(hikeBounds);
                map.setMinZoom(minZoomLock);
                startOrbit();
            }, dur + 200);

            if (dist < 0.8) {
                // Short/nearby hops — easeTo for smooth linear pan (no terrain jitter)
                map.easeTo({
                    center: [hike.lng, hike.lat],
                    zoom: targetZoom,
                    pitch: 65,
                    bearing: Math.random() * 60 - 30,
                    duration: dur
                });
            } else {
                // Longer trips — flyTo with cinematic arc
                map.flyTo({
                    center: [hike.lng, hike.lat],
                    zoom: targetZoom,
                    pitch: 65,
                    bearing: Math.random() * 60 - 30,
                    duration: dur,
                    curve: curve,
                    minZoom: minZ
                });
            }

            // Update trail path if available
            function showTrail() {
                var trail = getTrail(hike);
                if (trail && map.getSource('trail')) {
                    var isMulti = Array.isArray(trail[0]) && Array.isArray(trail[0][0]);
                    map.getSource('trail').setData({
                        type: 'Feature',
                        geometry: {
                            type: isMulti ? 'MultiLineString' : 'LineString',
                            coordinates: trail
                        }
                    });
                } else if (map.getSource('trail')) {
                    map.getSource('trail').setData({
                        type: 'FeatureCollection',
                        features: []
                    });
                }
            }
            // Load trail data for this hike if not cached, then show
            if (!getTrail(hike)) {
                loadTrail(hike.id, function () {
                    if (activeHikeId === hikeId) showTrail();
                });
            }
            showTrail(); // show immediately if already cached, or clear if not loaded yet
        }

        // Activate globe
        if (window.hikeGlobe) {
            window.hikeGlobe.activate(hike.lat, hike.lng, hike.name);
        }
    }

    // --- Globe → Page sync ---
    window.hikePageSelectHike = function (hikeId) {
        selectHike(hikeId);
    };

    // --- Text glitch + raw→live transition ---
    var allText = Array.from(document.querySelectorAll('.text'));
    function glitchBatch(start) {
        var end = Math.min(start + 8, allText.length);
        for (var i = start; i < end; i++) new TextGlitch(allText[i]).setText(language);
        if (end < allText.length) setTimeout(function () { glitchBatch(end); }, 60);
    }
    setTimeout(function () { glitchBatch(0); }, 200);

    setTimeout(function () {
        content.classList.remove('state-raw');
        content.classList.add('state-live');

        // Initialize map after transition
        setTimeout(initMap, 300);
    }, 1200);
});
