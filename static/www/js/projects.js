/* ============================================================
   PROJECTS PAGE — accordion, terminal typing, auto-cycling
   ============================================================ */

// Media paths for lazy loading (mp4 for animations, jpg for stills)
var PROJECT_MEDIA = [
    { src: '//static.scub3d.io/www/img/projects/minesweeper.mp4', type: 'video' },
    { src: '//static.scub3d.io/www/img/projects/business_card.mp4', type: 'video' },
    { src: '//static.scub3d.io/www/img/projects/saoui.mp4', type: 'video' },
    { src: '//static.scub3d.io/www/img/projects/jhinxz.jpg', type: 'image' },
    { src: '//static.scub3d.io/www/img/projects/scub3d.io.mp4', type: 'video' },
    { src: '//static.scub3d.io/www/img/projects/pysat-2.mp4', type: 'video' },
    { src: '//static.scub3d.io/www/img/projects/splatter.mp4', type: 'video' },
    { src: '//static.scub3d.io/www/img/projects/binging_with_babish.mp4', type: 'video' },
];

document.addEventListener('DOMContentLoaded', function() {
    var language = initCommon();

    var content = document.getElementById('content');

    // Stagger row appearance
    document.querySelectorAll('.proj-row').forEach(function(row, i) {
        row.style.setProperty('--stagger', (i * 0.05) + 's');
    });

    // Staggered text glitch
    var allText = Array.from(document.querySelectorAll('.text'));
    function glitchBatch(start) {
        var end = Math.min(start + 8, allText.length);
        for (var i = start; i < end; i++) new TextGlitch(allText[i]).setText(language);
        if (end < allText.length) setTimeout(function(){glitchBatch(end)}, 60);
    }
    setTimeout(function(){glitchBatch(0)}, 200);
    setTimeout(function(){content.classList.remove('state-raw');content.classList.add('state-live')}, 1200);

    // --- Accordion interaction ---
    var openIdx = null;
    var rows = document.querySelectorAll('.proj-row');
    var details = document.querySelectorAll('.proj-detail');
    var cds = document.querySelectorAll('.proj-cd');
    var loadedImages = {};
    var cmdEl = document.querySelector('.term-prompt .cmd');
    var cursorEl = document.querySelector('.term-prompt .cursor');

    var PROJECT_NAMES = [
        '3d-minesweeper','ar-business-card',
        'vr-sao-ui','jhinxz',
        'scub3d-io','pysat-2','project-spatter','binging-with-babish'
    ];

    function openProject(idx) {
        idx = String(idx);
        if (openIdx !== null) {
            rows[openIdx].classList.remove('open');
            details[openIdx].classList.remove('open');
            cds[openIdx].classList.remove('open');
        }
        if (openIdx === idx) { openIdx = null; return; }
        rows[idx].classList.add('open');
        details[idx].classList.add('open');
        cds[idx].classList.add('open');
        openIdx = idx;
        if (!loadedImages[idx]) {
            var mediaDiv = details[idx].querySelector('.proj-detail-media');
            var media = PROJECT_MEDIA[idx];
            if (media.type === 'video') {
                var vid = document.createElement('video');
                vid.src = media.src;
                vid.autoplay = true;
                vid.loop = true;
                vid.muted = true;
                vid.playsInline = true;
                vid.onloadeddata = function() { mediaDiv.innerHTML = ''; mediaDiv.appendChild(vid); };
            } else {
                var img = document.createElement('img');
                img.src = media.src;
                img.onload = function() { mediaDiv.innerHTML = ''; mediaDiv.appendChild(img); };
            }
            loadedImages[idx] = true;
        }
    }

    function closeProject() {
        if (openIdx !== null) {
            rows[openIdx].classList.remove('open');
            details[openIdx].classList.remove('open');
            cds[openIdx].classList.remove('open');
            openIdx = null;
        }
    }

    rows.forEach(function(row) {
        row.addEventListener('click', function() {
            userInteracted();
            var idx = row.dataset.idx;
            if (openIdx === idx) { closeProject(); setCmdText('ls -la'); }
            else { openProject(idx); setCmdText('cat ' + PROJECT_NAMES[idx] + '/README.md'); }
        });
    });

    // --- Terminal prompt typing ---
    function setCmdText(text) { cmdEl.textContent = text; }

    function typeText(text, callback) {
        var i = 0;
        cursorEl.classList.add('typing');
        setCmdText('');
        function next() {
            if (i < text.length) {
                setCmdText(text.substring(0, i + 1));
                i++;
                setTimeout(next, 80);
            } else {
                cursorEl.classList.remove('typing');
                if (callback) callback();
            }
        }
        next();
    }

    // --- Auto-cycling ---
    var FEATURED = [0, 1, 2, 3];
    var featuredIdx = 0;
    var autoTimer = null;
    var autoActive = true;
    var inactivityTimer = null;

    function clearAutoTimer() {
        if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    }

    function autoCycle() {
        if (!autoActive) return;
        var projIdx = FEATURED[featuredIdx % FEATURED.length];
        var name = PROJECT_NAMES[projIdx];

        typeText('cat ' + name + '/README.md', function() {
            if (!autoActive) return;
            autoTimer = setTimeout(function() {
                if (!autoActive) return;
                openProject(projIdx);

                autoTimer = setTimeout(function() {
                    if (!autoActive) return;
                    typeText('clear', function() {
                        if (!autoActive) return;
                        closeProject();

                        autoTimer = setTimeout(function() {
                            if (!autoActive) return;
                            featuredIdx++;
                            setCmdText('ls -la');
                            autoTimer = setTimeout(function() { autoCycle(); }, 1500);
                        }, 4000);
                    });
                }, 15000);
            }, 600);
        });
    }

    function userInteracted() {
        autoActive = false;
        clearAutoTimer();
        cursorEl.classList.remove('typing');
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(function() {
            autoActive = true;
            featuredIdx++;
            closeProject();
            setCmdText('ls -la');
            setTimeout(autoCycle, 1000);
        }, 30000);
    }

    setTimeout(function() { autoCycle(); }, 6000);
});
