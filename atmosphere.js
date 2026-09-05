(function () {
  'use strict';

  var ORDER = ['hero', 'about', 'technology', 'projects', 'record', 'contact'];
  var NAV_OF = { hero: 'hero', about: 'about', technology: 'about', projects: 'projects', record: 'record', contact: 'contact' };

  var STOPS = [
    {
      lx: 30, ly: -26, ls: 1.00, lo: 0.40, dx: -26, dy: 26, ds: 1.20, dp: 0.26,
      veil: 0.14, grid: 0.00, warm: 0.00,
      cz: 0, cy: 0.0, cs: 1.000,
      fr: 0.30, fl: 0.32, fd: 0.42, fa: 0.40, fx: 0.00, fy: 0.07, fg: 0.00, ft: 0.34, fe: 0.34
    },
    {
      lx: 6, ly: -4, ls: 1.16, lo: 0.50, dx: -14, dy: 12, ds: 1.28, dp: 0.34,
      veil: 0.24, grid: 0.08, warm: 0.14,
      cz: -46, cy: -1.1, cs: 1.030,
      fr: 0.64, fl: 0.11, fd: 0.60, fa: 0.30, fx: 0.44, fy: -0.20, fg: 0.12, ft: 0.56, fe: 0.10
    },
    {
      lx: -8, ly: 8, ls: 1.24, lo: 0.56, dx: 12, dy: 0, ds: 1.34, dp: 0.40,
      veil: 0.30, grid: 0.34, warm: 0.24,
      cz: -78, cy: -2.0, cs: 1.052,
      fr: 0.74, fl: 1.00, fd: 0.62, fa: 0.54, fx: 0.05, fy: 0.00, fg: 0.03, ft: 0.28, fe: 0.66
    },
    {
      lx: -16, ly: 14, ls: 1.34, lo: 0.68, dx: 20, dy: -8, ds: 1.44, dp: 0.52,
      veil: 0.38, grid: 0.26, warm: 0.44,
      cz: -215, cy: -3.0, cs: 1.125,
      fr: 0.98, fl: 0.84, fd: 1.00, fa: 0.64, fx: 0.00, fy: 0.02, fg: 0.00, ft: 0.46, fe: 0.54
    },
    {
      lx: 10, ly: -8, ls: 1.14, lo: 0.36, dx: -16, dy: 14, ds: 1.24, dp: 0.28,
      veil: 0.19, grid: 0.14, warm: 0.15,
      cz: -66, cy: 1.5, cs: 1.046,
      fr: 0.90, fl: 0.28, fd: 0.54, fa: 0.40, fx: -0.10, fy: 0.06, fg: 1.00, ft: 0.62, fe: 0.22
    },
    {
      lx: 2, ly: 10, ls: 1.02, lo: 0.22, dx: 6, dy: -4, ds: 1.10, dp: 0.15,
      veil: 0.09, grid: 0.04, warm: 0.05,
      cz: -14, cy: 0.5, cs: 1.010,
      fr: 0.44, fl: 0.03, fd: 0.20, fa: 0.15, fx: 0.00, fy: 0.00, fg: 0.26, ft: 0.40, fe: 0.03
    },
    {
      lx: -2, ly: 16, ls: 0.94, lo: 0.15, dx: 2, dy: -8, ds: 1.02, dp: 0.07,
      veil: 0.04, grid: 0.00, warm: 0.00,
      cz: 0, cy: 0.0, cs: 1.000,
      fr: 0.26, fl: 0.00, fd: 0.10, fa: 0.04, fx: 0.00, fy: 0.00, fg: 0.04, ft: 0.34, fe: 0.00
    }
  ];

  var KEYS = [
    'lx', 'ly', 'ls', 'lo', 'dx', 'dy', 'ds', 'dp', 'veil', 'grid', 'warm',
    'cz', 'cy', 'cs',
    'fr', 'fl', 'fd', 'fa', 'fx', 'fy', 'fg', 'ft', 'fe'
  ];

  var STATIC_P = 0.30;

  var stage = document.querySelector('.stage');
  var rig = document.querySelector('.stage-rig');
  var atmos = document.querySelector('.atmos');
  if (!stage || !rig || !atmos) return;

  var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

  var painters = [];
  var api = {
    state: {},
    p: 0,
    scene: 'hero',
    local: 0,
    scrollPx: 0,
    vw: 0,
    vh: 0,
    docRange: 1,
    small: false,
    reduced: reducedQuery.matches,
    mx: 0,
    my: 0,
    time: 0,
    cards: [],
    register: function (fn) { painters.push(fn); wake(); },
    wake: function () { wake(); },
    remeasure: function () { measure(); readScroll(); wake(); }
  };
  window.STAGE = api;

  var stopAt = [0, 0.09, 0.31, 0.45, 0.67, 0.90, 1];
  var scrollTarget = 0;
  var scrollValue = 0;
  var pointerTargetX = 0;
  var pointerTargetY = 0;
  var frame = null;
  var navLinks = [];
  var navActive = '';
  var timeline = null;
  var tlBox = { top: 0, h: 1 };
  var tlLast = -1;
  var headStuck = false;
  var head = document.querySelector('.site-head');

  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function sample(p) {
    var i = 0;
    while (i < stopAt.length - 2 && p > stopAt[i + 1]) i++;

    var a = STOPS[i];
    var b = STOPS[i + 1];
    var span = stopAt[i + 1] - stopAt[i];
    var raw = span <= 0 ? 0 : clamp01((p - stopAt[i]) / span);
    var t = smoothstep(raw);
    var s = api.state;

    for (var k = 0; k < KEYS.length; k++) {
      var key = KEYS[k];
      s[key] = a[key] + (b[key] - a[key]) * t;
    }

    api.scene = ORDER[Math.min(i, ORDER.length - 1)];
    api.local = raw;
    return s;
  }

  function accentOf(el) {
    var raw = el.getAttribute('style') || '';
    if (raw.indexOf('--pulse') > -1) return 'pulse';
    if (raw.indexOf('--ember') > -1) return 'ember';
    return 'signal';
  }

  function measure() {
    var doc = document.documentElement;
    api.vw = window.innerWidth;
    api.vh = window.innerHeight;
    api.small = api.vw < 760;
    api.docRange = Math.max(1, doc.scrollHeight - api.vh);

    var lead = api.vh * 0.25;
    var next = [0];
    for (var i = 1; i < ORDER.length; i++) {
      var el = document.getElementById(ORDER[i]);
      var top = el ? el.getBoundingClientRect().top + window.scrollY : api.docRange * (i / ORDER.length);
      next.push(clamp01((top - lead) / api.docRange));
    }
    next.push(1);

    var minSpan = Math.min(0.13, 700 / api.docRange);
    for (var j = next.length - 2; j >= 1; j--) {
      if (next[j] > next[j + 1] - minSpan) next[j] = next[j + 1] - minSpan;
    }
    for (var m = 1; m < next.length - 1; m++) {
      if (next[m] < next[m - 1] + 0.01) next[m] = next[m - 1] + 0.01;
    }
    stopAt = next;

    var cards = document.querySelectorAll('.deck .card');
    api.cards.length = 0;
    for (var c = 0; c < cards.length; c++) {
      var box = cards[c].getBoundingClientRect();
      api.cards.push({
        el: cards[c],
        top: box.top + window.scrollY,
        left: box.left,
        w: box.width,
        h: box.height,
        accent: accentOf(cards[c]),
        moving: false,
        last: -99
      });
    }

    if (timeline) {
      var tb = timeline.getBoundingClientRect();
      tlBox.top = tb.top + window.scrollY;
      tlBox.h = Math.max(1, tb.height);
    }
  }

  function readScroll() {
    scrollTarget = clamp01(window.scrollY / api.docRange);
  }

  function paintAtmos(s, px, py) {
    var st = atmos.style;
    st.setProperty('--l-x', (s.lx + px * 2.2).toFixed(2) + 'vw');
    st.setProperty('--l-y', (s.ly + py * 2.2).toFixed(2) + 'vh');
    st.setProperty('--l-s', s.ls.toFixed(3));
    st.setProperty('--l-o', s.lo.toFixed(3));
    st.setProperty('--d-x', (s.dx - px * 1.1).toFixed(2) + 'vw');
    st.setProperty('--d-y', (s.dy - py * 1.1).toFixed(2) + 'vh');
    st.setProperty('--d-s', s.ds.toFixed(3));
    st.setProperty('--d-o', s.dp.toFixed(3));
    st.setProperty('--v-o', s.veil.toFixed(3));
    st.setProperty('--v-y', (s.ly * -0.4 + py * 0.6).toFixed(2) + 'vh');
    st.setProperty('--g-o', s.grid.toFixed(3));
    st.setProperty('--g-y', (s.ly * 0.25).toFixed(2) + 'vh');
    st.setProperty('--w-o', s.warm.toFixed(3));
  }

  function paintCamera(s, px, py) {
    var st = rig.style;
    var damp = api.small ? 0.55 : 1;
    st.setProperty('--cam-z', (s.cz * damp).toFixed(1) + 'px');
    st.setProperty('--cam-y', (s.cy * damp + py * 0.35).toFixed(2) + 'vh');
    st.setProperty('--cam-s', (1 + (s.cs - 1) * damp).toFixed(4));
  }

  function paintCards() {
    var list = api.cards;
    var vh = api.vh;
    var reach = vh * 1.25;

    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var centre = c.top + c.h * 0.5 - api.scrollPx - vh * 0.5;

      if (centre > reach || centre < -reach) {
        if (c.moving) {
          c.el.classList.remove('is-moving');
          c.el.style.setProperty('--cd-z', '0px');
          c.el.style.setProperty('--cd-rx', '0deg');
          c.el.style.setProperty('--cd-spill', '0');
          c.moving = false;
          c.last = -99;
        }
        c.rel = 2;
        continue;
      }

      var rel = centre / vh;
      c.rel = rel;
      if (Math.abs(rel - c.last) < 0.0025) continue;
      c.last = rel;

      if (!c.moving) { c.el.classList.add('is-moving'); c.moving = true; }

      var away = Math.abs(rel);
      var depth = api.state.fd;
      var st = c.el.style;
      st.setProperty('--cd-z', (-away * 96 * depth).toFixed(1) + 'px');
      st.setProperty('--cd-rx', (-rel * 5.2 * depth).toFixed(2) + 'deg');
      st.setProperty('--cd-spill', Math.max(0, 1 - away * 1.45).toFixed(3));
    }
  }

  function paintNav() {
    var want = NAV_OF[api.scene] || 'hero';
    if (want === navActive) return;
    navActive = want;
    for (var i = 0; i < navLinks.length; i++) {
      var link = navLinks[i];
      if (link.getAttribute('data-spy') === want) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }

  function paintTimeline() {
    if (!timeline) return;
    var v = clamp01((api.scrollPx + api.vh * 0.62 - tlBox.top) / tlBox.h);
    if (Math.abs(v - tlLast) < 0.002) return;
    tlLast = v;
    timeline.style.setProperty('--progress', v.toFixed(4));
  }

  function paintHead() {
    if (!head) return;
    var stuck = api.scrollPx > 12;
    if (stuck === headStuck) return;
    headStuck = stuck;
    head.classList.toggle('head-stuck', stuck);
  }

  function paintAll(s) {
    api.scrollPx = scrollValue * api.docRange;
    paintAtmos(s, api.mx, api.my);
    paintCamera(s, api.mx, api.my);
    paintCards();
    paintNav();
    paintTimeline();
    paintHead();
    for (var i = 0; i < painters.length; i++) painters[i](api);
  }

  function settle() {
    measure();
    readScroll();
    scrollValue = scrollTarget;
    api.p = scrollValue;
    api.mx = pointerTargetX;
    api.my = pointerTargetY;
    paintAll(sample(scrollValue));
  }

  function tick(now) {
    api.time = now || 0;

    var ds = scrollTarget - scrollValue;
    var dx = pointerTargetX - api.mx;
    var dy = pointerTargetY - api.my;
    var still = Math.abs(ds) < 0.00008 && Math.abs(dx) < 0.0008 && Math.abs(dy) < 0.0008;

    if (still) {
      scrollValue = scrollTarget;
      api.mx = pointerTargetX;
      api.my = pointerTargetY;
    } else {
      scrollValue += ds * 0.075;
      api.mx += dx * 0.055;
      api.my += dy * 0.055;
    }

    api.p = scrollValue;
    paintAll(sample(scrollValue));

    if (still && !api.idle) { frame = null; return; }
    frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (frame === null) frame = requestAnimationFrame(tick);
  }

  function start() {
    atmos.classList.add('is-live');
    navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-list a[data-spy]'));
    timeline = document.querySelector('.timeline');

    settle();

    if (api.reduced) {
      scrollTarget = STATIC_P;
      scrollValue = STATIC_P;
      api.p = STATIC_P;
      paintAll(sample(STATIC_P));
      paintNav();
      return;
    }

    window.addEventListener('scroll', function () {
      readScroll();
      wake();
    }, { passive: true });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        measure();
        readScroll();
        wake();
      }, 90);
      measure();
      readScroll();
      wake();
    }, { passive: true });

    if (fineQuery.matches) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        pointerTargetX = (e.clientX / api.vw - 0.5) * 2;
        pointerTargetY = (e.clientY / api.vh - 0.5) * 2;
        wake();
      }, { passive: true });

      window.addEventListener('pointerleave', function () {
        pointerTargetX = 0;
        pointerTargetY = 0;
        wake();
      }, { passive: true });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      } else if (!document.hidden) {
        wake();
      }
    });

    window.addEventListener('load', function () {
      measure();
      readScroll();
      wake();
    });

    wake();
  }

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
