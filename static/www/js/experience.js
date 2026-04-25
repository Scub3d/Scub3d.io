/* ============================================================
   EXPERIENCE PAGE — staggered glitch, scroll activation, raw-to-live
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
    var language = initCommon();

    var content = document.getElementById('content');

    // Glitch text + raw→live transition — staggered, visible elements first
    var allText = Array.from(document.querySelectorAll('.text'));
    var batchSize = 8;
    var batchDelay = 60;
    function glitchBatch(startIdx) {
        var end = Math.min(startIdx + batchSize, allText.length);
        for (var i = startIdx; i < end; i++) {
            new TextGlitch(allText[i]).setText(language);
        }
        if (end < allText.length) {
            setTimeout(function () { glitchBatch(end); }, batchDelay);
        }
    }
    setTimeout(function () { glitchBatch(0); }, 200);
    setTimeout(function () { content.classList.remove('state-raw'); content.classList.add('state-live') }, 1200);

    // --- Media data ---
    var EXPERIENCE_MEDIA = {
        'archer': {
            title: 'Store No8 — Walmart',
            items: [
                { type: 'youtube', id: 'w4CMP-jJDU0' }
            ]
        },
        'nasa-2019': {
            title: 'NASA: Goddard Space Flight Center (2019)',
            items: [
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_01.jpg', alt: 'NASA GSFC 2019' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_02.jpg', alt: 'NASA 2019 poster' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_03.jpg', alt: 'NASA clean room' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_04.png', alt: 'NASA GSFC 2019' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_05.png', alt: 'NASA GSFC 2019' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_06.png', alt: 'NASA GSFC 2019' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_07.jpg', alt: 'NASA GSFC 2019' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_08.jpg', alt: 'NASA GSFC 2019' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_09.jpg', alt: 'NASA GSFC 2019' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_10.jpg', alt: 'NASA GSFC 2019' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2019/photo_11.jpg', alt: 'NASA GSFC 2019' },
                { type: 'youtube', id: 'ozBC4YsErf8' },
                { type: 'youtube', id: 'Ja5Xe-CGFD4' },

            ]
        },
        'unity': {
            title: 'Unity Technologies',
            items: [
                { type: 'image', src: '../../static/www/img/experience/unity/photo_01.jpg', alt: 'Unity Student Ambassador' },
                { type: 'image', src: '../../static/www/img/experience/unity/photo_02.jpg', alt: 'Unity Student Ambassador headshot' }
            ]
        },
        'dverse': {
            title: 'DVERSE',
            items: [
                { type: 'image', src: '../../static/www/img/experience/dverse.jpg', alt: 'DVERSE internship Tokyo' }
            ]
        },
        'nasa-2017': {
            title: 'NASA: Goddard Space Flight Center (2017)',
            items: [
                { type: 'image', src: '../../static/www/img/experience/nasa 2017/photo_01.jpg', alt: 'NASA GSFC 2017' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2017/photo_02.jpg', alt: 'NASA GSFC 2017' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2017/photo_03.jpg', alt: 'NASA GSFC 2017' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2017/photo_04.png', alt: 'NASA GSFC 2017' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2017/photo_05.png', alt: 'NASA GSFC 2017' },
                { type: 'image', src: '../../static/www/img/experience/nasa 2017/photo_06.png', alt: 'NASA GSFC 2017' }
            ]
        }
    };

    // --- Scroll-based activation (closest to viewport center) ---
    var activeEntry = null;
    var allEntries = Array.from(document.querySelectorAll('.timeline-entry'));

    function findClosestEntry() {
        var viewCenter = window.innerHeight / 2;
        var closest = null;
        var closestDist = Infinity;
        allEntries.forEach(function (el) {
            var rect = el.getBoundingClientRect();
            var elCenter = rect.top + rect.height / 2;
            var dist = Math.abs(elCenter - viewCenter);
            if (dist < closestDist) {
                closestDist = dist;
                closest = el;
            }
        });
        return closest;
    }

    function activateEntry(el) {
        if (!el || el === activeEntry) return;
        if (activeEntry) activeEntry.classList.remove('active');
        el.classList.add('active');
        activeEntry = el;
        var lat = parseFloat(el.dataset.lat);
        var lng = parseFloat(el.dataset.lng);
        var loc = el.dataset.location || '';
        if (!isNaN(lat) && !isNaN(lng) && window.globeActivate) {
            window.globeActivate(lat, lng, loc);
        }
    }

    var scrollTicking = false;
    window.addEventListener('scroll', function () {
        if (!scrollTicking) {
            requestAnimationFrame(function () {
                activateEntry(findClosestEntry());
                scrollTicking = false;
            });
            scrollTicking = true;
        }
    });

    // Activate first entry on load
    setTimeout(function () { activateEntry(allEntries[0]); }, 1300);

    // --- Media triggers (inject into cards that have media) ---
    allEntries.forEach(function (entry) {
        var key = entry.dataset.mediaKey;
        if (!key || !EXPERIENCE_MEDIA[key]) return;
        var media = EXPERIENCE_MEDIA[key];
        var card = entry.querySelector('.timeline-card');
        if (!card) return;
        var trigger = document.createElement('div');
        trigger.className = 'timeline-card-media-trigger';
        var count = media.items.length;
        trigger.textContent = '[' + count + ' MEDIA] -->';
        card.appendChild(trigger);
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            openLightbox(key, 0);
        });
    });

    // --- Lightbox ---
    var lightbox = document.createElement('div');
    lightbox.className = 'media-lightbox';
    lightbox.innerHTML = '<div class="media-lightbox-modal">'
        + '<div class="media-lightbox-header">'
        + '<span class="media-lightbox-title"></span>'
        + '<span class="media-lightbox-counter"></span>'
        + '<button class="media-lightbox-close">[CLOSE]</button>'
        + '</div>'
        + '<div class="media-lightbox-body">'
        + '<button class="media-lightbox-prev">&lt;</button>'
        + '<div class="media-lightbox-content"></div>'
        + '<button class="media-lightbox-next">&gt;</button>'
        + '</div>'
        + '<div class="media-lightbox-thumbnails"></div>'
        + '</div>';
    document.body.appendChild(lightbox);

    var lbModal = lightbox.querySelector('.media-lightbox-modal');
    var lbTitle = lightbox.querySelector('.media-lightbox-title');
    var lbCounter = lightbox.querySelector('.media-lightbox-counter');
    var lbClose = lightbox.querySelector('.media-lightbox-close');
    var lbContent = lightbox.querySelector('.media-lightbox-content');
    var lbPrev = lightbox.querySelector('.media-lightbox-prev');
    var lbNext = lightbox.querySelector('.media-lightbox-next');
    var lbThumbnails = lightbox.querySelector('.media-lightbox-thumbnails');
    var lbCurrentKey = null;
    var lbCurrentIdx = 0;
    var lbIsOpen = false;

    function buildThumbnails(media) {
        lbThumbnails.innerHTML = '';
        media.items.forEach(function (item, i) {
            var thumb = document.createElement('div');
            thumb.className = 'media-lightbox-thumb';
            if (i === lbCurrentIdx) thumb.classList.add('active');

            if (item.type === 'image') {
                var img = document.createElement('img');
                img.src = item.src;
                img.alt = item.alt || '';
                thumb.appendChild(img);
            } else {
                // Video or youtube — dark placeholder with play icon
                thumb.style.background = 'var(--bg-tertiary)';
                var play = document.createElement('div');
                play.className = 'media-lightbox-thumb-play';
                play.textContent = '\u25B6';
                thumb.appendChild(play);
            }

            thumb.addEventListener('click', function (e) {
                e.stopPropagation();
                goToItem(i);
            });
            lbThumbnails.appendChild(thumb);
        });
    }

    function updateThumbnailHighlight() {
        var thumbs = lbThumbnails.querySelectorAll('.media-lightbox-thumb');
        thumbs.forEach(function (t, i) {
            t.classList.toggle('active', i === lbCurrentIdx);
        });
    }

    function goToItem(idx) {
        if (!lbCurrentKey) return;
        var media = EXPERIENCE_MEDIA[lbCurrentKey];
        stopCurrentMedia();
        lbCurrentIdx = idx;
        showLightboxItem();
        updateThumbnailHighlight();
    }

    function stopCurrentMedia() {
        var vid = lbContent.querySelector('video');
        if (vid) vid.pause();
        var yt = lbContent.querySelector('iframe');
        if (yt) yt.src = '';
    }

    function openLightbox(key, idx) {
        var media = EXPERIENCE_MEDIA[key];
        if (!media) return;
        lbCurrentKey = key;
        lbCurrentIdx = idx || 0;
        lbTitle.textContent = media.title;
        lightbox.classList.toggle('single-item', media.items.length <= 1);
        buildThumbnails(media);
        showLightboxItem();
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
        lbIsOpen = true;
    }

    function closeLightbox() {
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
        lbIsOpen = false;
        stopCurrentMedia();
    }

    function showLightboxItem() {
        var media = EXPERIENCE_MEDIA[lbCurrentKey];
        var item = media.items[lbCurrentIdx];
        lbContent.innerHTML = '';

        if (item.type === 'youtube') {
            var iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + item.id + '?rel=0';
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.className = 'media-lightbox-youtube';
            lbContent.appendChild(iframe);
        } else if (item.type === 'video') {
            var video = document.createElement('video');
            video.src = item.src;
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            lbContent.appendChild(video);
        } else {
            var img = document.createElement('img');
            img.src = item.src;
            img.alt = item.alt || '';
            lbContent.appendChild(img);
        }

        var current = String(lbCurrentIdx + 1).padStart(2, '0');
        var total = String(media.items.length).padStart(2, '0');
        lbCounter.textContent = current + ' / ' + total;
    }

    function lightboxNav(delta) {
        if (!lbCurrentKey) return;
        var media = EXPERIENCE_MEDIA[lbCurrentKey];
        stopCurrentMedia();
        lbCurrentIdx = (lbCurrentIdx + delta + media.items.length) % media.items.length;
        showLightboxItem();
        updateThumbnailHighlight();
    }

    // Lightbox event listeners
    lbClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
        // Close when clicking the backdrop (not the modal itself)
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    lbPrev.addEventListener('click', function (e) { e.stopPropagation(); lightboxNav(-1); });
    lbNext.addEventListener('click', function (e) { e.stopPropagation(); lightboxNav(1); });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
        if (!lbIsOpen) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') lightboxNav(-1);
        if (e.key === 'ArrowRight') lightboxNav(1);
    });

    // Touch swipe
    var touchStartX = 0;
    var touchStartY = 0;
    var SWIPE_THRESHOLD = 50;
    lightbox.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].screenX - touchStartX;
        var dy = e.changedTouches[0].screenY - touchStartY;
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) lightboxNav(1);
            else lightboxNav(-1);
        }
    });

});
