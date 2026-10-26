/* ═══════════════════════════════════════════════════════════════
   INGRHVAC MONTERREY  |  app.js
   Dependencias (CDN, ver index.html): GSAP + ScrollTrigger, Lenis.
   Si alguna librería no carga, la página sigue siendo 100% legible:
   se activan los respaldos CSS (.no-gsap / .no-js).
   No se usa window.addEventListener('scroll'): el scroll se maneja con
   ScrollTrigger, Lenis e IntersectionObserver.
═══════════════════════════════════════════════════════════════ */
(() => {
    'use strict';
    window.__ingrOK = true;

    /* ═══════════════ CONFIGURACIÓN (único lugar a editar) ═══════════════ */
    const CONFIG = {
        // Número de WhatsApp del negocio: código de país + lada + número, solo dígitos.
        // Ejemplo para Monterrey: '528112345678'. Mientras tenga "X", los enlaces abren
        // WhatsApp para que la persona elija contacto (modo demostración).
        whatsapp: '52XXXXXXXXXX',
        brand: 'INGRHVAC Monterrey',
        messages: {
            general: 'Hola INGRHVAC Monterrey, quiero información sobre sus servicios.',
            repair:  'Hola INGRHVAC Monterrey, mi equipo necesita atención. Les cuento: ',
            cold:    'Hola INGRHVAC Monterrey, quiero cotizar un cuarto frío o una caja refrigerada. Les cuento mi proyecto: ',
            course:  'Hola INGRHVAC Monterrey, quiero inscribirme a un curso de capacitación.'
        }
    };

    /* ═══════════════ UTILIDADES ═══════════════ */
    const $  = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const root = document.documentElement;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasLibs      = !!(window.gsap && window.ScrollTrigger);
    const useScroll    = hasLibs && !reduceMotion;          // animaciones ligadas al scroll
    root.classList.add(useScroll ? 'has-gsap' : 'no-gsap');
    if (hasLibs) { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.config({ ignoreMobileResize: true }); }

    let lenis = null;
    let menuOpen = false;

    /* ═══════════════ WHATSAPP ═══════════════ */
    const waReady = /^\d{10,15}$/.test(CONFIG.whatsapp);
    const waLink = (text) => (waReady ? `https://wa.me/${CONFIG.whatsapp}` : 'https://wa.me/') + `?text=${encodeURIComponent(text)}`;

    function wireWhatsApp() {
        $$('[data-wa]').forEach(a => {
            a.href = waLink(CONFIG.messages[a.dataset.wa] || CONFIG.messages.general);
            a.target = '_blank';
            a.rel = 'noopener';
        });
        if (waReady) {
            const n = CONFIG.whatsapp.replace(/^52/, '');
            const pretty = '+52 ' + n.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
            $$('[data-wa-display]').forEach(el => { el.textContent = pretty; });
        } else {
            console.warn('[INGRHVAC] Falta el número de WhatsApp: edita CONFIG.whatsapp en app.js');
        }
    }

    /* ═══════════════ TEXTO: partir en palabras ═══════════════ */
    function splitHeading(el) {
        let idx = 0;
        el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
        const walk = (node) => {
            Array.from(node.childNodes).forEach(child => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const s = document.createElement('span');
                        const i = document.createElement('i');
                        s.className = 'sw';
                        s.setAttribute('aria-hidden', 'true');
                        i.textContent = part;
                        i.style.setProperty('--wi', idx++);
                        s.appendChild(i);
                        frag.appendChild(s);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    walk(child);
                }
            });
        };
        walk(el);
        el.classList.add('is-split');
    }

    function splitPlainWords(el) {
        const words = [];
        const text = el.textContent.trim().replace(/\s+/g, ' ');
        el.setAttribute('aria-label', text);
        el.textContent = '';
        text.split(' ').forEach((word, i, arr) => {
            const s = document.createElement('span');
            s.className = 'w';
            s.setAttribute('aria-hidden', 'true');
            s.textContent = word;
            el.appendChild(s);
            words.push(s);
            if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
        });
        return words;
    }

    /* ═══════════════ LOADER: medidor de temperatura ═══════════════ */
    function svgLine(x1, y1, x2, y2, cls) {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', x1.toFixed(2)); l.setAttribute('y1', y1.toFixed(2));
        l.setAttribute('x2', x2.toFixed(2)); l.setAttribute('y2', y2.toFixed(2));
        if (cls) l.setAttribute('class', cls);
        return l;
    }

    function buildTicks(group, cx, cy, count, rIn, rOut, rMajor, majorEvery) {
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            const major = i % majorEvery === 0;
            const r2 = major ? rMajor : rOut;
            group.appendChild(svgLine(
                cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn,
                cx + Math.cos(a) * r2,  cy + Math.sin(a) * r2,
                major ? 'is-major' : ''
            ));
        }
    }

    function runLoader() {
        return new Promise(resolve => {
            const loader = $('#loader');
            if (!loader) { resolve(); return; }

            buildTicks($('.loader__ticks', loader), 110, 110, 60, 94, 99, 105, 5);
            const tempEl = $('#ld-temp');
            const fill = $('.loader__fill', loader);
            document.body.style.overflow = 'hidden';

            const MIN = reduceMotion ? 200 : 2300;
            const t0 = performance.now();
            let ready = false;
            let p = 0;

            // Listo cuando cargan las fuentes y la foto principal (con tope de 4.5 s)
            const heroImg = $('.arch img');
            const waits = [
                document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
                heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve()
            ];
            Promise.all(waits).then(() => { ready = true; });
            setTimeout(() => { ready = true; }, 4500);

            const render = () => {
                fill.style.strokeDashoffset = String(100 * (1 - p));
                tempEl.textContent = String(Math.round(38 - 17 * p));
            };

            const tick = (now) => {
                const timeP = clamp((now - t0) / MIN, 0, 1);
                const target = Math.min(timeP, ready ? 1 : 0.9);
                p += (target - p) * 0.12;
                if (ready && timeP >= 1 && p > 0.996) p = 1;
                render();
                if (p < 1) { requestAnimationFrame(tick); return; }
                finish();
            };

            const finish = () => {
                loader.classList.add('is-out');
                // La entrada del hero arranca mientras la persiana se abre
                setTimeout(() => { resolve(); }, 420);
                setTimeout(() => { loader.remove(); }, 1500);
            };

            requestAnimationFrame(tick);
        });
    }

    /* ═══════════════ SCROLL SUAVE (Lenis) ═══════════════ */
    function initLenis() {
        if (!window.Lenis || reduceMotion) return;
        lenis = new Lenis({
            duration: 1.25,
            easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.9
        });
        if (hasLibs) {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add(time => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
        } else {
            const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
            requestAnimationFrame(raf);
        }
    }

    function initAnchors() {
        $$('a[href^="#"]').forEach(a => {
            a.addEventListener('click', e => {
                const id = a.getAttribute('href');
                if (!id || id.length < 2) return;
                const target = $(id);
                if (!target) return;
                e.preventDefault();
                if (menuOpen) closeMenu();
                if (lenis) lenis.scrollTo(target, { offset: id === '#inicio' ? 0 : -76, duration: 1.7 });
                else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
            });
        });

        // Tarjetas de servicio: preseleccionan el interés del formulario
        $$('[data-interest]').forEach(a => {
            a.addEventListener('click', () => {
                const sel = $('#f-interest');
                if (!sel) return;
                const opt = Array.from(sel.options).find(o => o.value === a.dataset.interest || o.text === a.dataset.interest);
                if (opt) sel.value = opt.value;
            });
        });
    }

    /* ═══════════════ NAVEGACIÓN ═══════════════ */
    const nav = $('#nav');
    const menu = $('#menu');
    const burger = $('#burger');

    function openMenu() {
        menuOpen = true;
        menu.classList.add('is-open');
        menu.setAttribute('aria-hidden', 'false');
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Cerrar menú');
        nav.classList.remove('is-hidden');
        document.body.style.overflow = 'hidden';
        if (lenis) lenis.stop();
        [$('main'), $('footer'), $('.wa-float')].forEach(el => { if (el) el.inert = true; });
    }
    function closeMenu() {
        menuOpen = false;
        menu.classList.remove('is-open');
        menu.setAttribute('aria-hidden', 'true');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Abrir menú');
        document.body.style.overflow = '';
        if (lenis) lenis.start();
        [$('main'), $('footer'), $('.wa-float')].forEach(el => { if (el) el.inert = false; });
    }

    function initNav() {
        burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { closeMenu(); burger.focus(); } });
        $$('a', menu).forEach(a => a.addEventListener('click', () => { if (menuOpen) closeMenu(); }));
        window.matchMedia('(min-width: 960px)').addEventListener('change', e => { if (e.matches && menuOpen) closeMenu(); });

        // Enlace activo según la sección visible
        const links = new Map($$('.nav__links a').map(a => [a.getAttribute('href'), a]));
        const spy = new IntersectionObserver(entries => {
            entries.forEach(en => {
                const link = links.get('#' + en.target.id);
                if (link) link.classList.toggle('is-current', en.isIntersecting);
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ['servicios', 'ciclo', 'sectores', 'cursos', 'faq'].forEach(id => { const s = document.getElementById(id); if (s) spy.observe(s); });

        if (useScroll) {
            // Barra de progreso + la barra se oculta al bajar y reaparece al subir
            gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.25 } });
            ScrollTrigger.create({
                start: 0, end: 'max',
                onUpdate: self => nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 240 && !menuOpen)
            });
        }
    }

    /* ═══════════════ HERO: campo térmico (canvas) ═══════════════ */
    const heroState = { px: 0.68, py: 0.42, active: false, lastMove: 0 };

    function initHeroField() {
        const canvas = $('.hero__field');
        const hero = $('.hero');
        if (!canvas || !hero) return;
        const ctx = canvas.getContext('2d');
        const COLD = [11, 99, 214], WARM = [232, 98, 44], NEUTRAL = [118, 146, 184];
        let w = 0, h = 0, dpr = 1, parts = [], raf = 0, running = false, t = 0;

        const spawn = (p, anywhere) => {
            p.x = anywhere ? Math.random() * w : -10 - Math.random() * 60;
            p.y = Math.random() * h;
            p.hot = Math.random() < 0.26;
            p.s = 0.7 + Math.random() * 1.1;
            p.life = 0;
            p.max = 260 + Math.random() * 380;
            p.px = p.x; p.py = p.y;
            return p;
        };

        const resize = () => {
            const r = canvas.getBoundingClientRect();
            dpr = Math.min(window.devicePixelRatio || 1, 1.75);
            w = Math.max(1, Math.floor(r.width * dpr));
            h = Math.max(1, Math.floor(r.height * dpr));
            canvas.width = w; canvas.height = h;
            const density = r.width < 700 ? 11000 : 6200;
            const n = clamp(Math.floor((r.width * r.height) / density), 60, 360);
            parts = Array.from({ length: n }, () => spawn({}, true));
            ctx.clearRect(0, 0, w, h);
        };

        const angleAt = (x, y) => {
            const n = Math.sin(x * 0.0021 / dpr + t * 0.31) + Math.sin(y * 0.0027 / dpr - t * 0.23) + Math.sin((x + y) * 0.0014 / dpr + t * 0.17);
            return n * 0.62;           // sesgo hacia la derecha: el aire fluye
        };

        const step = () => {
            // El "puntero virtual" recorre el hero cuando nadie lo mueve
            if (!heroState.active || performance.now() - heroState.lastMove > 2600) {
                heroState.active = false;
                heroState.px = 0.66 + 0.2 * Math.cos(t * 0.33);
                heroState.py = 0.44 + 0.22 * Math.sin(t * 0.47);
            }
            const cx = heroState.px * w, cy = heroState.py * h;
            const radius = Math.min(w, h) * 0.42;

            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,0.045)';      // estela larga: se ve el flujo del aire
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineCap = 'round';

            for (const p of parts) {
                const a = angleAt(p.x, p.y);
                const dx0 = p.x - cx, dy0 = p.y - cy;
                const d = Math.hypot(dx0, dy0) || 1;
                const cold = clamp(1 - d / radius, 0, 1);
                const speed = p.s * dpr * (1.05 - cold * 0.4);
                p.px = p.x; p.py = p.y;
                p.x += Math.cos(a) * speed + (dx0 / d) * cold * 0.9 * dpr;
                p.y += Math.sin(a) * speed + (dy0 / d) * cold * 0.9 * dpr;
                p.life++;

                const base = p.hot ? WARM : NEUTRAL;
                const k = cold * cold * (3 - 2 * cold);
                const r = Math.round(lerp(base[0], COLD[0], k));
                const g = Math.round(lerp(base[1], COLD[1], k));
                const b = Math.round(lerp(base[2], COLD[2], k));
                const fade = Math.min(1, p.life / 30, (p.max - p.life) / 30);
                const alpha = clamp((0.34 + k * 0.5 + (p.hot ? 0.1 : 0)) * fade, 0, 0.9);

                ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
                ctx.lineWidth = (1.3 + k * 1.7) * dpr;
                ctx.beginPath();
                ctx.moveTo(p.px, p.py);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();

                if (p.life > p.max || p.x > w + 20 || p.y < -20 || p.y > h + 20) spawn(p, false);
            }
        };

        const loop = () => {
            if (!running) return;
            t += 0.016;
            step();
            if (heroState.tick) heroState.tick();
            raf = requestAnimationFrame(loop);
        };
        const start = () => { if (!running && !reduceMotion) { running = true; raf = requestAnimationFrame(loop); } };
        const stop = () => { running = false; cancelAnimationFrame(raf); };

        resize();
        if (reduceMotion) { for (let i = 0; i < 150; i++) { t += 0.016; step(); } }

        new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop()), { threshold: 0 }).observe(hero);
        document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (hero.getBoundingClientRect().bottom > 0) start(); });
        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 200); });
    }

    function initHeroInteraction() {
        const hero = $('.hero');
        const arch = $('.arch');
        const dialTicks = $('.dial__ticks');
        const readout = $('#dial-temp');
        if (!hero) return;

        // Dial técnico: marcas giratorias
        if (dialTicks) buildTicks(dialTicks, 300, 300, 120, 242, 250, 262, 10);

        if (finePointer && !reduceMotion) {
            hero.addEventListener('pointermove', e => {
                const r = hero.getBoundingClientRect();
                heroState.px = (e.clientX - r.left) / r.width;
                heroState.py = (e.clientY - r.top) / r.height;
                heroState.active = true;
                heroState.lastMove = performance.now();
                if (arch) {
                    arch.style.setProperty('--rx', ((0.5 - heroState.py) * 7).toFixed(2) + 'deg');
                    arch.style.setProperty('--ry', ((heroState.px - 0.5) * 9).toFixed(2) + 'deg');
                }
            });
            hero.addEventListener('pointerleave', () => {
                if (arch) { arch.style.setProperty('--rx', '0deg'); arch.style.setProperty('--ry', '0deg'); }
            });
        }

        // Lectura del termostato: se enfría a medida que el aire frío se mueve a la derecha
        if (readout) {
            let shown = 21;
            let n = 0;
            // Se actualiza desde el bucle del campo térmico (solo corre con el hero visible)
            heroState.tick = () => {
                if (++n % 6) return;
                shown = lerp(shown, 31 - 15 * clamp(heroState.px, 0, 1), 0.2);
                readout.textContent = shown.toFixed(1);
            };
        }

        // El texto del hero se desvanece suavemente al salir
        if (useScroll) {
            gsap.to('.hero__copy', {
                yPercent: -8, opacity: 0.15, ease: 'none',
                scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
            });
        }
    }

    /* ═══════════════ REVELADOS (IntersectionObserver) ═══════════════ */
    function initReveals() {
        // Retardo escalonado en grupos
        $$('[data-stagger]').forEach(group => {
            $$(':scope > [data-reveal]', group).forEach((el, i) => el.style.setProperty('--d', (i * 0.09).toFixed(2) + 's'));
        });
        $$('[data-split]').forEach(splitHeading);

        const io = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (!en.isIntersecting) return;
                en.target.classList.add('in');
                io.unobserve(en.target);
            });
        }, { rootMargin: '0px 0px -9% 0px', threshold: 0.1 });
        $$('[data-reveal], [data-split]').forEach(el => io.observe(el));
    }

    function initCounters() {
        const els = $$('[data-count]');
        if (!els.length) return;
        const io = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (!en.isIntersecting) return;
                const el = en.target;
                const to = Number(el.dataset.count) || 0;
                const dur = reduceMotion ? 0 : 1400;
                const t0 = performance.now();
                const tick = now => {
                    const k = dur ? clamp((now - t0) / dur, 0, 1) : 1;
                    el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
                    if (k < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
                io.unobserve(el);
            });
        }, { threshold: 0.6 });
        els.forEach(el => { if (!reduceMotion) el.textContent = '0'; io.observe(el); });
    }

    /* ═══════════════ ANIMACIONES LIGADAS AL SCROLL (GSAP) ═══════════════ */
    function initManifesto() {
        const el = $('.manifesto__text');
        if (!el) return;
        const words = splitPlainWords(el);
        if (!useScroll) return;
        gsap.fromTo(words, { opacity: 0.15 }, {
            opacity: 1, ease: 'none', stagger: 0.14,
            scrollTrigger: { trigger: el, start: 'top 84%', end: 'bottom 58%', scrub: 0.6 }
        });
    }

    function initExpand(mm) {
        const sec = $('.xp');
        if (!sec) return;
        const build = (fromClip) => {
            const frame = $('.xp__frame', sec), img = $('img', frame), copy = $('.xp__copy', sec);
            const scrim = $('.xp__scrim', sec), wl = $('.xp__w--l', sec), wr = $('.xp__w--r', sec);
            const tl = gsap.timeline({
                defaults: { ease: 'none' },
                scrollTrigger: { trigger: sec, start: 'top top', end: '+=170%', scrub: 0.8, pin: '.xp__pin', anticipatePin: 1, invalidateOnRefresh: true }
            });
            // fromTo con cadenas explícitas: el navegador abrevia inset(a b a b) a inset(a b)
            // y GSAP no podría interpolar contra una cadena de 4 valores.
            tl.fromTo(frame, { clipPath: fromClip }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1 }, 0)
              .fromTo(img, { scale: 1.32 }, { scale: 1, duration: 1 }, 0)
              .to(wl, { xPercent: -28, opacity: 0, duration: 0.7 }, 0)
              .to(wr, { xPercent: 28, opacity: 0, duration: 0.7 }, 0)
              .to(scrim, { opacity: 1, duration: 0.45 }, 0.62)
              .to(copy, { opacity: 1, y: 0, duration: 0.45 }, 0.74)
              .to({}, { duration: 0.3 });
        };
        mm.add('(min-width: 960px)', () => build('inset(24% 31% 24% 31% round 26px)'));
        mm.add('(max-width: 959px)', () => build('inset(25% 11% 31% 11% round 22px)'));
    }

    function initCycle(mm) {
        const svg = $('.cycle__svg');
        const steps = $$('.step');
        if (!svg || !steps.length) return;
        const comps = $$('.cy-comp', svg);
        const names = ['Compresor', 'Condensador', 'Válvula de expansión', 'Evaporador'];
        const now = $('.cycle__now');

        const setActive = (i) => {
            steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
            comps.forEach(c => c.classList.toggle('is-on', Number(c.dataset.c) === i));
            svg.classList.add('has-active');
            svg.dataset.active = String(i);
            if (now) now.textContent = names[i];
        };
        setActive(0);

        mm.add('(min-width: 960px)', () => {
            steps.forEach((s, i) => ScrollTrigger.create({
                trigger: s, start: 'top 60%', end: 'bottom 60%',
                onToggle: self => { if (self.isActive) setActive(i); }
            }));
        });
        mm.add('(max-width: 959px)', () => {
            steps.forEach((s, i) => ScrollTrigger.create({
                trigger: s, start: 'top 80%', end: 'bottom 80%',
                onToggle: self => { if (self.isActive) setActive(i); }
            }));
        });
    }

    function initSectors(mm) {
        const sec = $('.sectors');
        const pin = $('.sectors__pin');
        const track = $('.sectors__track');
        if (!sec || !pin || !track) return;
        mm.add('(min-width: 960px)', () => {
            sec.classList.add('is-pan');
            const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
            const tween = gsap.to(track, {
                x: () => -dist(), ease: 'none',
                scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), pin: pin, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true }
            });
            // Teclado: al enfocar un enlace de un panel fuera de vista, se avanza el scroll vertical hasta mostrarlo
            const onFocus = (e) => {
                const panel = e.target.closest('.panel');
                const st = tween.scrollTrigger;
                const d = dist();
                if (!panel || !st || !d) return;
                const y = st.start + clamp(panel.offsetLeft / d, 0, 1) * (st.end - st.start);
                if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
            };
            track.addEventListener('focusin', onFocus);
            return () => {
                track.removeEventListener('focusin', onFocus);
                sec.classList.remove('is-pan');
                gsap.set(track, { clearProps: 'transform' });
            };
        });
    }

    function initTimeline() {
        const tl = $('.timeline');
        if (!tl) return;
        const items = $$('.tl', tl);
        if (!useScroll) { items.forEach(i => i.classList.add('is-on')); return; }
        gsap.fromTo(tl, { '--p': 0 }, {
            '--p': 1, ease: 'none',
            scrollTrigger: { trigger: tl, start: 'top 68%', end: 'bottom 58%', scrub: 0.5 }
        });
        items.forEach(item => ScrollTrigger.create({
            trigger: item, start: 'top 66%',
            onEnter: () => item.classList.add('is-on'),
            onLeaveBack: () => item.classList.remove('is-on')
        }));
    }

    /* ═══════════════ COMPONENTES ═══════════════ */
    function initMarquee() {
        const track = $('.strip__track');
        const list = $('.strip__list');
        if (track && list) track.appendChild(list.cloneNode(true));
    }

    function initTabs() {
        const wrap = $('.tabs');
        if (!wrap) return;
        const tabs = $$('.tab', wrap);
        const panels = $$('.tabpanel');
        const medias = $$('.media');
        const cta = $('#course-cta');
        const thumb = document.createElement('span');
        thumb.className = 'tabs__thumb';
        wrap.prepend(thumb);

        const moveThumb = (btn) => {
            thumb.style.width = btn.offsetWidth + 'px';
            thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
        };

        const select = (btn, focus) => {
            const id = btn.dataset.tab;
            tabs.forEach(t => {
                const on = t === btn;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
            });
            panels.forEach(p => {
                const on = p.id === btn.getAttribute('aria-controls');
                p.hidden = !on;
                p.classList.toggle('is-active', on);
                if (on && cta) {
                    cta.href = waLink(CONFIG.messages.course + ' Me interesa: ' + p.dataset.course + '.');
                }
            });
            medias.forEach(m => m.classList.toggle('is-active', m.dataset.for === id));
            moveThumb(btn);
            if (focus) btn.focus();
        };

        tabs.forEach((btn, i) => {
            btn.addEventListener('click', () => select(btn));
            btn.addEventListener('keydown', e => {
                let n = null;
                if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
                if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
                if (e.key === 'Home') n = tabs[0];
                if (e.key === 'End') n = tabs[tabs.length - 1];
                if (n) { e.preventDefault(); select(n, true); }
            });
        });

        const current = () => tabs.find(t => t.classList.contains('is-active')) || tabs[0];
        select(current());
        window.addEventListener('resize', () => moveThumb(current()));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveThumb(current()));
    }

    function initFaq() {
        $$('.faq details').forEach(d => {
            const sum = $('summary', d);
            const body = $('.faq__a', d);
            let anim = null;
            sum.addEventListener('click', e => {
                e.preventDefault();
                if (anim) anim.cancel();
                const dur = reduceMotion ? 0 : 520;
                const ease = 'cubic-bezier(.16,1,.3,1)';
                if (!d.open) {
                    d.open = true;
                    const h = body.scrollHeight;
                    anim = body.animate([{ height: '0px' }, { height: h + 'px' }], { duration: dur, easing: ease });
                    anim.onfinish = () => { anim = null; if (hasLibs) ScrollTrigger.refresh(); };
                } else {
                    const h = body.offsetHeight;
                    anim = body.animate([{ height: h + 'px' }, { height: '0px' }], { duration: dur, easing: ease });
                    anim.onfinish = () => { d.open = false; anim = null; if (hasLibs) ScrollTrigger.refresh(); };
                }
            });
        });
    }

    function initSpotlight() {
        if (!finePointer) return;
        $$('.cell').forEach(cell => {
            cell.addEventListener('pointermove', e => {
                const r = cell.getBoundingClientRect();
                cell.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                cell.style.setProperty('--my', (e.clientY - r.top) + 'px');
            });
        });
    }

    function initMagnetic() {
        if (!finePointer || reduceMotion) return;
        $$('[data-magnetic]').forEach(btn => {
            btn.addEventListener('pointermove', e => {
                const r = btn.getBoundingClientRect();
                const x = (e.clientX - (r.left + r.width / 2)) * 0.22;
                const y = (e.clientY - (r.top + r.height / 2)) * 0.32;
                btn.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
            });
            btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
        });
    }

    /* ═══════════════ FORMULARIO → WHATSAPP ═══════════════ */
    function initForm() {
        const form = $('#wa-form');
        if (!form) return;
        const name = $('#f-name'), phone = $('#f-phone'), interest = $('#f-interest'), msg = $('#f-msg');
        const status = $('#form-status');
        const label = $('#submit-label');
        const labelDefault = label.textContent;

        const setErr = (input, errId, text) => {
            const err = document.getElementById(errId);
            err.textContent = text;
            if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
        };
        name.addEventListener('input', () => setErr(name, 'err-name', ''));
        interest.addEventListener('change', () => setErr(interest, 'err-interest', ''));

        form.addEventListener('submit', e => {
            e.preventDefault();
            let firstBad = null;
            if (name.value.trim().length < 2) { setErr(name, 'err-name', 'Escribe tu nombre para poder atenderte.'); firstBad = firstBad || name; }
            if (!interest.value) { setErr(interest, 'err-interest', 'Elige qué necesitas para dirigir tu mensaje.'); firstBad = firstBad || interest; }
            if (firstBad) { firstBad.focus(); status.textContent = ''; return; }

            let text = `Hola ${CONFIG.brand}, soy ${name.value.trim()}.\nMe interesa: ${interest.value}.`;
            if (phone.value.trim()) text += `\nMi teléfono: ${phone.value.trim()}.`;
            if (msg.value.trim()) text += `\n\n${msg.value.trim()}`;
            text += '\n\nQuedo atento a su respuesta. Gracias.';
            const url = waLink(text);

            label.textContent = 'Abriendo WhatsApp…';
            status.innerHTML = 'Si WhatsApp no se abre, <a href="' + url + '" target="_blank" rel="noopener">haz clic aquí</a>.';
            window.open(url, '_blank', 'noopener');
            setTimeout(() => { label.textContent = labelDefault; form.reset(); }, 1600);
        });
    }

    /* ═══════════════ IMÁGENES: respaldo si una foto no carga ═══════════════ */
    function initImageFallback() {
        document.addEventListener('error', e => {
            const t = e.target;
            if (t && t.tagName === 'IMG') {
                const fig = t.closest('figure');
                if (fig) fig.classList.add('img-fail');
                t.style.visibility = 'hidden';
            }
        }, true);
    }

    /* ═══════════════ ARRANQUE ═══════════════ */
    function setupStatic() {
        wireWhatsApp();
        initImageFallback();
        initMarquee();
        initHeroField();
        initHeroInteraction();
        initReveals();
        initCounters();
        initTabs();
        initFaq();
        initSpotlight();
        initMagnetic();
        initForm();
        initNav();
        initAnchors();
        const y = $('#year'); if (y) y.textContent = String(new Date().getFullYear());
    }

    function setupScroll() {
        if (!useScroll) { initManifesto(); initTimeline(); return; }
        const mm = gsap.matchMedia();
        initManifesto();
        initExpand(mm);
        initCycle(mm);
        initSectors(mm);
        initTimeline();
    }

    function boot() {
        setupStatic();
        runLoader().then(() => {
            document.body.style.overflow = '';
            root.classList.add('is-ready');
            initLenis();
            setupScroll();
            const refresh = () => { if (hasLibs) ScrollTrigger.refresh(); };
            if (document.readyState === 'complete') setTimeout(refresh, 300);
            else window.addEventListener('load', () => setTimeout(refresh, 300), { once: true });
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(refresh, 100));
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
