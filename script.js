/* ============================================================
   Shreyas Tiwari — portfolio behaviour

   CONTACT FORM: leave FORM_ENDPOINT empty and the form opens the
   visitor's email app with the message prefilled — works with no
   backend. Paste a Formspree/Getform/Basin URL below and it will
   POST there instead and report the real result.
   ============================================================ */

var FORM_ENDPOINT = '';
var CONTACT_EMAIL = 'shreyastiwari0531@gmail.com';

(function () {
  'use strict';

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = motionQuery.matches;
  var memoryTheme = null;

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ---------- theme ---------- */

  function readTheme() {
    try {
      return localStorage.getItem('theme');
    } catch (e) {
      return memoryTheme;
    }
  }

  function storeTheme(value) {
    memoryTheme = value;
    try {
      localStorage.setItem('theme', value);
    } catch (e) { /* storage unavailable — session only */ }
  }

  function initTheme() {
    var root = document.documentElement;
    var btn = document.querySelector('.theme-toggle');
    var current = root.getAttribute('data-theme') || readTheme() || 'dark';

    root.setAttribute('data-theme', current);
    if (!btn) return;

    function label(theme) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      btn.setAttribute('aria-pressed', String(theme === 'light'));
    }

    label(current);

    btn.addEventListener('click', function () {
      current = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', current);
      storeTheme(current);
      label(current);
    });
  }

  /* ---------- page load sequence ---------- */

  function initHeroSequence() {
    var done = false;

    function go() {
      if (done) return;
      done = true;
      document.body.classList.add('ready');
    }

    requestAnimationFrame(function () { requestAnimationFrame(go); });
    setTimeout(go, 400);
  }

  /* ---------- navigation ---------- */

  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.site-nav');
    if (!toggle || !nav) return;

    function close() {
      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }

    toggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
        close();
        toggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 760) close();
    });
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });
  }

  /* ---------- counters ---------- */

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function countUp(el, delay) {
    var end = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    if (isNaN(end)) return;

    if (reduced) {
      el.textContent = end.toFixed(decimals);
      return;
    }

    el.textContent = (0).toFixed(decimals);
    var start = null;

    setTimeout(function () {
      requestAnimationFrame(function frame(now) {
        if (start === null) start = now;
        var p = Math.min((now - start) / 1300, 1);
        el.textContent = (end * easeOutExpo(p)).toFixed(decimals);
        if (p < 1) requestAnimationFrame(frame);
      });
    }, delay || 0);
  }

  function initPortrait() {
    var img = document.querySelector('.portrait-img');
    if (!img) return;

    var names = ['profile.jpg', 'profile.jpeg', 'profile.png', 'profile.webp'];
    var i = 0;

    function tryNext() {
      i += 1;
      if (i < names.length) img.setAttribute('src', names[i]);
      else img.classList.add('is-missing');
    }

    img.addEventListener('error', tryNext);
    if (img.complete && img.naturalWidth === 0) tryNext();
  }

  /* ---------- scroll reveal ---------- */

  function initReveal() {
    var items = document.querySelectorAll('.reveal, .reveal-line');

    if (!('IntersectionObserver' in window) || reduced) {
      items.forEach(function (el) { el.classList.add('seen'); });
      document.querySelectorAll('.reveal [data-count]').forEach(function (el) { countUp(el, 0); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = Number(el.getAttribute('data-delay') || 0);
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('seen');
        el.querySelectorAll('[data-count]').forEach(function (num, i) {
          countUp(num, delay + i * 120);
        });
        observer.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- contact form ---------- */

  function initContactForm() {
    var form = document.querySelector('#contact-form');
    if (!form) return;

    var note = document.querySelector('#form-note');
    var button = form.querySelector('button[type="submit"]');

    function say(text, bad) {
      note.textContent = text;
      note.classList.toggle('bad', Boolean(bad));
      note.classList.remove('show');
      requestAnimationFrame(function () { note.classList.add('show'); });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      var message = form.elements.message.value.trim();

      if (!name || !email || !message) {
        say('Fill in your name, email, and message before sending.', true);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        say('That email address looks incomplete. Check it and try again.', true);
        return;
      }

      if (!FORM_ENDPOINT) {
        var subject = encodeURIComponent('Portfolio enquiry from ' + name);
        var body = encodeURIComponent(message + '\n\n—\n' + name + '\n' + email);
        window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + subject + '&body=' + body;
        say('Opening your email app. If nothing happens, write to ' + CONTACT_EMAIL + '.', false);
        return;
      }

      button.disabled = true;
      say('Sending…', false);

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, message: message })
      })
        .then(function (res) {
          if (!res.ok) throw new Error(res.status);
          form.reset();
          say('Message sent. I usually reply within a day or two.', false);
        })
        .catch(function () {
          say('That did not send. Email me directly at ' + CONTACT_EMAIL + '.', true);
        })
        .then(function () { button.disabled = false; });
    });
  }

  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  onReady(function () {
    initTheme();
    initNav();
    initSmoothScroll();
    initReveal();
    initContactForm();
    initYear();
    initHeroSequence();
    initPortrait();
    window.__live = 1;
  });

  motionQuery.addEventListener('change', function (e) { reduced = e.matches; });
})();
