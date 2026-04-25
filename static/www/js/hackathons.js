/* ============================================================
   HACKATHONS PAGE — pixelation effect, raw-to-live transition
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
    var language = initCommon();

    // --- Dynamic hackathon count ---
    var hackCount = document.querySelectorAll('.hack-card').length;
    var countEl = document.getElementById('hackCount');
    if (countEl) {
        var enSpan = countEl.querySelector('.englishText');
        var jpSpan = countEl.querySelector('.japaneseText');
        if (enSpan) enSpan.textContent = '[' + hackCount + ' EVENTS]';
        if (jpSpan) jpSpan.textContent = '[' + hackCount + 'イベント]';
    }

    // --- Pixelation effect on card images ---
    function pixelateImage(img, onReady) {
        var canvas = document.createElement('canvas');
        canvas.className = 'hack-card-pixelate';
        var ctx = canvas.getContext('2d');

        function start() {
            var w = img.naturalWidth || 200;
            var h = img.naturalHeight || 300;
            canvas.width = w;
            canvas.height = h;

            var steps = [4, 8, 16, 32, 64, w];
            var stepIndex = 0;

            ctx.imageSmoothingEnabled = false;
            var sw = steps[0];
            var sh = Math.round(sw * h / w);
            ctx.drawImage(img, 0, 0, sw, sh);
            ctx.drawImage(canvas, 0, 0, sw, sh, 0, 0, w, h);

            img.style.opacity = '0';
            var inner = img.closest('.hack-card-inner');
            if (inner) inner.insertBefore(canvas, img);

            onReady(function resolve(delay) {
                function nextStep() {
                    stepIndex++;
                    if (stepIndex >= steps.length) {
                        img.style.opacity = '1';
                        img.style.transition = 'opacity 0.3s';
                        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
                        return;
                    }
                    var sw = steps[stepIndex];
                    var sh = Math.round(sw * h / w);
                    ctx.clearRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, sw, sh);
                    ctx.drawImage(canvas, 0, 0, sw, sh, 0, 0, w, h);
                    setTimeout(nextStep, 80 + Math.random() * 120);
                }
                setTimeout(nextStep, delay);
            });
        }

        if (img.complete && img.naturalWidth > 0) {
            start();
        } else {
            img.style.opacity = '0';
            img.onload = start;
        }
    }

    // Set up pixelation on all card images
    var resolvers = [];
    var transitionDone = false;
    document.querySelectorAll('.hack-card-img').forEach(function (img) {
        pixelateImage(img, function (resolve) {
            if (transitionDone) {
                // Image loaded after transition — depixelate immediately
                resolve(Math.random() * 300);
            } else {
                resolvers.push(resolve);
            }
        });
    });

    // --- Raw → Live transition ---
    var content = document.getElementById('content');

    setTimeout(function () {
        document.querySelectorAll('.text').forEach(function (el) { new TextGlitch(el).setText(language); });
    }, 200);

    setTimeout(function () {
        content.classList.remove('state-raw');
        content.classList.add('state-live');
        transitionDone = true;

        resolvers.forEach(function (resolve) {
            var delay = Math.random() * 600;
            resolve(delay);
        });
    }, 1200);

    // --- Mark cards that open modals (all except external-link cards) ---
    var allCards = Array.from(document.querySelectorAll('.hack-card[data-hack-key]'));
    allCards.forEach(function (card) {
        if (!card.hasAttribute('data-external')) {
            card.classList.add('has-detail');
        }
    });

    // --- Hackathon project modal ---
    var modal = document.createElement('div');
    modal.className = 'hack-modal';
    modal.innerHTML = '<div class="hack-modal-dialog">'
        + '<div class="hack-modal-header">'
        + '<span class="hack-modal-title"></span>'
        + '<span class="hack-modal-counter"></span>'
        + '<button class="hack-modal-close">[CLOSE]</button>'
        + '</div>'
        + '<div class="hack-modal-scroll">'
        + '<div class="hack-modal-project"></div>'
        + '<div class="hack-modal-gallery">'
        + '<div class="hack-modal-media-body">'
        + '<button class="hack-modal-prev">&lt;</button>'
        + '<div class="hack-modal-media-content"></div>'
        + '<button class="hack-modal-next">&gt;</button>'
        + '</div>'
        + '<div class="hack-modal-thumbnails"></div>'
        + '</div>'
        + '</div>'
        + '</div>';
    document.body.appendChild(modal);

    var hmTitle = modal.querySelector('.hack-modal-title');
    var hmCounter = modal.querySelector('.hack-modal-counter');
    var hmClose = modal.querySelector('.hack-modal-close');
    var hmProject = modal.querySelector('.hack-modal-project');
    var hmGallery = modal.querySelector('.hack-modal-gallery');
    var hmContent = modal.querySelector('.hack-modal-media-content');
    var hmPrev = modal.querySelector('.hack-modal-prev');
    var hmNext = modal.querySelector('.hack-modal-next');
    var hmThumbnails = modal.querySelector('.hack-modal-thumbnails');
    var hmCurrentKey = null;
    var hmCurrentIdx = 0;
    var hmIsOpen = false;

    function populateProject(data) {
        var html = '<div class="hack-modal-fields">';

        // [PROJECT] field — always present
        html += '<span class="hack-modal-field-label">[PROJECT]</span>';
        html += '<span class="hack-modal-field-value">' + data.project + '</span>';

        // [BUILT IN] field — duration + team
        var builtParts = [];
        if (data.duration) builtParts.push(data.duration);
        if (data.team) builtParts.push(data.team);
        if (builtParts.length) {
            html += '<span class="hack-modal-field-label">[BUILT IN]</span>';
            html += '<span class="hack-modal-field-value">' + builtParts.join(' | ') + '</span>';
        }

        // [STACK] field — tech tags
        if (data.tech && data.tech.length) {
            html += '<span class="hack-modal-field-label">[STACK]</span>';
            html += '<span class="hack-modal-field-value">';
            data.tech.forEach(function (t) {
                html += '<span class="hack-modal-tag">' + t + '</span>';
            });
            html += '</span>';
        }

        // [RESULT] field — awards
        if (data.awards) {
            html += '<span class="hack-modal-field-label">[RESULT]</span>';
            html += '<span class="hack-modal-field-value result">' + data.awards + '</span>';
        }

        html += '</div>';

        // Description paragraph
        if (data.description) {
            html += '<p class="hack-modal-desc">' + data.description + '</p>';
        }

        // Quote / testimonial callout
        if (data.quote) {
            html += '<div class="hack-modal-quote">';
            html += '<span class="hack-modal-quote-mark">&ldquo;</span>';
            html += '<p class="hack-modal-quote-text">' + data.quote.text + '</p>';
            html += '<span class="hack-modal-quote-attr">';
            if (data.quote.url) {
                html += '<a href="' + data.quote.url + '" target="_blank" class="hack-modal-quote-link">' + data.quote.author + ' &#8599;</a>';
            } else {
                html += data.quote.author;
            }
            html += '</span>';
            html += '</div>';
        }

        // Links
        if (data.links && data.links.length) {
            html += '<div class="hack-modal-links">';
            data.links.forEach(function (l) {
                html += '<a href="' + l.url + '" target="_blank" class="hack-modal-link">[' + l.label + ' &#8599;]</a>';
            });
            html += '</div>';
        }

        hmProject.innerHTML = html;
    }

    function populateBasicInfo(card) {
        var html = '<div class="hack-modal-fields">';

        var locEl = card.querySelector('.hack-card-location .displayText');
        var loc = locEl ? locEl.textContent : '';
        if (loc) {
            html += '<span class="hack-modal-field-label">[LOCATION]</span>';
            html += '<span class="hack-modal-field-value">' + loc + '</span>';
        }

        var roleEl = card.querySelector('.hack-card-role');
        var role = roleEl ? roleEl.textContent.replace(/[\[\]]/g, '') : '';
        if (role) {
            html += '<span class="hack-modal-field-label">[ROLE]</span>';
            html += '<span class="hack-modal-field-value">' + role + '</span>';
        }

        html += '</div>';

        var cardHref = card.getAttribute('href');
        if (cardHref && cardHref !== '#') {
            html += '<div class="hack-modal-links">';
            html += '<a href="' + cardHref + '" target="_blank" class="hack-modal-link">[Devpost &#8599;]</a>';
            html += '</div>';
        }

        hmProject.innerHTML = html;
    }

    function buildHackThumbnails(media) {
        hmThumbnails.innerHTML = '';
        media.forEach(function (item, i) {
            var thumb = document.createElement('div');
            thumb.className = 'hack-modal-thumb';
            if (i === hmCurrentIdx) thumb.classList.add('active');

            if (item.type === 'image') {
                var img = document.createElement('img');
                img.src = item.src;
                img.alt = item.alt || '';
                thumb.appendChild(img);
            } else {
                thumb.style.background = 'var(--bg-tertiary)';
                var play = document.createElement('div');
                play.className = 'hack-modal-thumb-play';
                play.textContent = '\u25B6';
                thumb.appendChild(play);
            }

            thumb.addEventListener('click', function (e) {
                e.stopPropagation();
                hmGoToItem(i);
            });
            hmThumbnails.appendChild(thumb);
        });
    }

    function updateHackThumbHighlight() {
        var thumbs = hmThumbnails.querySelectorAll('.hack-modal-thumb');
        thumbs.forEach(function (t, i) {
            t.classList.toggle('active', i === hmCurrentIdx);
        });
    }

    function hmGoToItem(idx) {
        if (!hmCurrentKey) return;
        hmStopMedia();
        hmCurrentIdx = idx;
        showHackMediaItem();
        updateHackThumbHighlight();
    }

    function hmStopMedia() {
        hmContent.querySelectorAll('video').forEach(function (vid) { vid.pause(); });
        var yt = hmContent.querySelector('iframe');
        if (yt) yt.src = '';
    }

    function openHackModal(key, card) {
        var data = (typeof HACKATHON_DATA !== 'undefined') ? HACKATHON_DATA[key] : null;
        hmCurrentKey = key;
        hmCurrentIdx = 0;

        // Title from card DOM
        var nameEl = card.querySelector('.hack-card-name .displayText');
        var dateEl = card.querySelector('.hack-card-date .displayText');
        var name = nameEl ? nameEl.textContent : '';
        var date = dateEl ? dateEl.textContent : '';
        hmTitle.textContent = name + (date ? ' \u2014 ' + date : '');

        // Project info
        if (data) {
            populateProject(data);
        } else {
            populateBasicInfo(card);
        }

        // Media gallery
        var hasMedia = data && data.media && data.media.length > 0;
        hmGallery.classList.toggle('no-media', !hasMedia);
        modal.classList.toggle('single-media', !hasMedia || (data && data.media.length <= 1));

        if (hasMedia) {
            buildHackThumbnails(data.media);
            showHackMediaItem();
        } else {
            hmContent.innerHTML = '';
            hmCounter.textContent = '';
        }

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        hmIsOpen = true;
    }

    function closeHackModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
        hmIsOpen = false;
        hmStopMedia();
    }

    function showHackMediaItem() {
        var data = HACKATHON_DATA[hmCurrentKey];
        if (!data || !data.media || !data.media.length) return;
        var item = data.media[hmCurrentIdx];
        hmContent.innerHTML = '';

        if (item.type === 'youtube') {
            var iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + item.id + '?rel=0';
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.className = 'hack-modal-youtube';
            hmContent.appendChild(iframe);
        } else if (item.type === 'grid') {
            var grid = document.createElement('div');
            grid.className = 'hack-modal-grid';
            item.items.forEach(function (sub) {
                var v = document.createElement('video');
                v.src = sub.src;
                v.autoplay = true;
                v.loop = true;
                v.muted = true;
                v.playsInline = true;
                v.preload = 'metadata';
                grid.appendChild(v);
            });
            hmContent.appendChild(grid);
        } else if (item.type === 'video') {
            var video = document.createElement('video');
            video.src = item.src;
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            hmContent.appendChild(video);
        } else {
            var img = document.createElement('img');
            img.src = item.src;
            img.alt = item.alt || '';
            hmContent.appendChild(img);
        }

        var current = String(hmCurrentIdx + 1).padStart(2, '0');
        var total = String(data.media.length).padStart(2, '0');
        hmCounter.textContent = current + ' / ' + total;
    }

    function hackModalNav(delta) {
        if (!hmCurrentKey) return;
        var data = HACKATHON_DATA[hmCurrentKey];
        if (!data || !data.media || !data.media.length) return;
        hmStopMedia();
        hmCurrentIdx = (hmCurrentIdx + delta + data.media.length) % data.media.length;
        showHackMediaItem();
        updateHackThumbHighlight();
    }

    // Click delegation on the grid
    var hackGrid = document.querySelector('.hack-grid');
    if (hackGrid) {
        hackGrid.addEventListener('click', function (e) {
            var card = e.target.closest('.hack-card');
            if (!card) return;
            if (card.hasAttribute('data-external')) return;
            e.preventDefault();
            var key = card.dataset.hackKey;
            if (key) openHackModal(key, card);
        });
    }

    // Close button + backdrop click
    hmClose.addEventListener('click', closeHackModal);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeHackModal();
    });

    // Prev/next
    hmPrev.addEventListener('click', function (e) { e.stopPropagation(); hackModalNav(-1); });
    hmNext.addEventListener('click', function (e) { e.stopPropagation(); hackModalNav(1); });

    // Keyboard
    document.addEventListener('keydown', function (e) {
        if (!hmIsOpen) return;
        if (e.key === 'Escape') closeHackModal();
        if (e.key === 'ArrowLeft') hackModalNav(-1);
        if (e.key === 'ArrowRight') hackModalNav(1);
    });

    // Touch swipe
    var hmTouchStartX = 0;
    var hmTouchStartY = 0;
    modal.addEventListener('touchstart', function (e) {
        hmTouchStartX = e.changedTouches[0].screenX;
        hmTouchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    modal.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].screenX - hmTouchStartX;
        var dy = e.changedTouches[0].screenY - hmTouchStartY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) hackModalNav(1);
            else hackModalNav(-1);
        }
    });
});
