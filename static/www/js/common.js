/* ============================================================
   GLITCHED TEXT — Vanilla JS (adapted from existing glitched-text.js)
   ============================================================ */
const TEXT_GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#_______&#*+%?£@§$abcdefghijklmnopqrstuvwxyz1234567890!あえいうおかきくけこさしすせそたちつてとをになぬねのまめむみもはふへほ';
const TEXT_GLITCH_REDUCED_MOTION = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class TextGlitch {
    constructor(el) {
        this.el = el;
        this.display = el.querySelector('span.displayText');
        this.update = this.update.bind(this);
        this.isException = el.classList.contains('exception');
    }

    _applyLangClass(language) {
        this.el.classList.remove('english', 'japanese');
        if (this.isException) {
            this.el.classList.add(language !== 'japanese' ? 'japanese' : 'english');
        } else {
            this.el.classList.add(language);
        }
    }

    _snap(text, language) {
        this.display.textContent = text;
        this._applyLangClass(language);
    }

    setText(language) {
        const display = this.display;
        if (!display) return Promise.resolve();
        const oldText = display.textContent;
        const engEl = this.el.querySelector('span.englishText');
        const jpEl = this.el.querySelector('span.japaneseText');
        const newText = this.isException
            ? (language !== 'japanese' ? engEl.textContent : jpEl.textContent)
            : this.el.querySelector('span.' + language + 'Text').textContent;

        // Skip the glitch once if marked (e.g. nav links after a header
        // click — the user just saw these on the previous page, so don't
        // re-animate them in). Also skip for users with reduced-motion.
        if (this.el.dataset.skipGlitchOnce === '1' || TEXT_GLITCH_REDUCED_MOTION) {
            this._snap(newText, language);
            delete this.el.dataset.skipGlitchOnce;
            return Promise.resolve();
        }

        const length = Math.max(oldText.length, newText.length);
        const promise = new Promise((resolve) => this.resolve = resolve);
        this.queue = new Array(length);

        for (let i = 0; i < length; i++) {
            const start = Math.floor(Math.random() * 40);
            this.queue[i] = {
                from: oldText[i] || '',
                to: newText[i] || '',
                start: start,
                end: start + Math.floor(Math.random() * 40),
                char: '',
                mode: -1
            };
        }

        // Build one <span> per position once. Per-frame updates only mutate
        // textContent/className on these nodes — no innerHTML reparse, which
        // is the hot-path bottleneck when many .text elements animate
        // concurrently (experience/hackathons pages have 60+ to 120+).
        display.textContent = '';
        const nodes = new Array(length);
        const frag = document.createDocumentFragment();
        for (let i = 0; i < length; i++) {
            const span = document.createElement('span');
            nodes[i] = span;
            frag.appendChild(span);
        }
        display.appendChild(frag);
        this.nodes = nodes;

        cancelAnimationFrame(this.frameRequest);
        this.frame = 0;
        this.currentLanguage = language;
        this._applyLangClass(language);
        this.update();
        return promise;
    }

    update() {
        const queue = this.queue;
        const nodes = this.nodes;
        const chars = TEXT_GLITCH_CHARS;
        const frame = this.frame;
        let complete = 0;

        for (let i = 0, n = queue.length; i < n; i++) {
            const item = queue[i];
            const span = nodes[i];
            if (frame >= item.end) {
                complete++;
                if (item.mode !== 2) {
                    span.textContent = item.to;
                    if (item.mode === 1) span.className = '';
                    item.mode = 2;
                }
            } else if (frame >= item.start) {
                if (!item.char || Math.random() < 0.28) {
                    const c = chars.charAt(Math.floor(Math.random() * chars.length));
                    if (c !== item.char) {
                        item.char = c;
                        span.textContent = c;
                    }
                }
                if (item.mode !== 1) {
                    span.className = 'dud';
                    item.mode = 1;
                }
            } else if (item.mode !== 0) {
                span.textContent = item.from;
                item.mode = 0;
            }
        }

        if (complete === queue.length) {
            // Flatten children back to a single text node so later queries
            // (language toggle) read a clean string without extra DOM.
            this.display.textContent = this.display.textContent;
            this.nodes = null;
            this.resolve();
        } else {
            this.frameRequest = requestAnimationFrame(this.update);
            this.frame = frame + 2;
        }
    }
}

function glitchText(element, language) {
    new TextGlitch(element).setText(language);
}


/* ============================================================
   COOKIE UTILITY (replaces jquery.cookie)
   ============================================================ */
function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}
function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days || 365) * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/';
}


/* ============================================================
   COMMON SITE INIT — language toggle, mobile nav
   ============================================================ */
function initCommon() {
    let language = getCookie('language') || 'english';
    setCookie('language', language);

    function updateLangLabels() {
        document.querySelectorAll('.nav-lang-label').forEach(function (el) {
            el.textContent = language === 'english' ? 'JP' : 'EN';
        });
    }
    updateLangLabels();

    // If the user just clicked a nav link to get here, snap the nav text
    // to its final value and tag it so the page-level glitch leaves it
    // alone (TextGlitch.setText honors data-skip-glitch-once). Direct
    // page loads / refreshes still see the full glitch animation.
    const navClickKey = 'navClickSkip';
    if (sessionStorage.getItem(navClickKey) === '1') {
        sessionStorage.removeItem(navClickKey);
        document.querySelectorAll('.site-nav .text, .nav-overlay .text').forEach(function (el) {
            const display = el.querySelector('span.displayText');
            const langSpan = el.querySelector('span.' + language + 'Text');
            if (display && langSpan) {
                display.textContent = langSpan.textContent;
                el.classList.remove('english', 'japanese');
                el.classList.add(language);
                el.dataset.skipGlitchOnce = '1';
            }
        });
    }
    // Set the flag right before any nav-link navigation so the next page
    // can skip its nav glitch. Skip language toggles (.js-translate) and
    // external/_blank links (they don't navigate the current tab).
    document.querySelectorAll('.site-nav a, .nav-overlay a').forEach(function (a) {
        if (a.classList.contains('js-translate')) return;
        if (a.target === '_blank') return;
        a.addEventListener('click', function () {
            sessionStorage.setItem(navClickKey, '1');
        });
    });

    // Translation toggle
    document.querySelectorAll('.js-translate').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            language = language === 'english' ? 'japanese' : 'english';
            setCookie('language', language);
            updateLangLabels();
            document.querySelectorAll('.text').forEach(function (el) {
                glitchText(el, language);
            });
        });
    });

    // Mobile nav
    const overlay = document.getElementById('navOverlay');
    if (overlay) {
        document.querySelectorAll('.js-nav-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () { overlay.classList.toggle('open'); });
        });
        document.querySelectorAll('.js-nav-close').forEach(function (btn) {
            btn.addEventListener('click', function () { overlay.classList.remove('open'); });
        });
        overlay.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () { overlay.classList.remove('open'); });
        });
        // Tap on empty overlay backdrop closes it. Clicks on descendant
        // buttons/links bubble up but target !== overlay, so they're skipped.
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.classList.remove('open');
        });
        // Esc closes too.
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                overlay.classList.remove('open');
            }
        });
    }

    return language;
}