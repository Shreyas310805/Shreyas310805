(function () {
  'use strict';

  var api = window.STAGE;
  var canvas = document.getElementById('field');
  if (!api || !canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  var root = document.documentElement;
  var FOCAL = 2.6;
  var TILT = 0.34;

  var count = 0;
  var mx, my, mz, sx, sy, sz;
  var px, py, ps;
  var order = [];
  var edgeA, edgeB, edgeK;
  var edgeCount = 0;

  var dpr = 1;
  var vw = 0;
  var vh = 0;
  var spin = 0;
  var lastTime = 0;

  var tone = { sr: 36, sg: 217, sb: 190, pr: 155, pg: 123, pb: 255 };
  var accents = { signal: '#24D9BE', pulse: '#9B7BFF', ember: '#E9A845' };
  var glows = {};
  var live = false;
  var mul = 1;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function build(n) {
    count = n;
    mx = new Float32Array(n); my = new Float32Array(n); mz = new Float32Array(n);
    sx = new Float32Array(n); sy = new Float32Array(n); sz = new Float32Array(n);
    px = new Float32Array(n); py = new Float32Array(n); ps = new Float32Array(n);
    order = new Array(n);

    var rand = rng(20260905);
    var golden = Math.PI * (3 - Math.sqrt(5));

    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var th = golden * i;
      var j = 0.82 + rand() * 0.34;
      mx[i] = Math.cos(th) * r * j;
      my[i] = y * j;
      mz[i] = Math.sin(th) * r * j;
      sx[i] = (rand() - 0.5) * 3.4;
      sy[i] = (rand() - 0.5) * 2.6;
      sz[i] = (rand() - 0.5) * 2.2;
      order[i] = i;
    }

    var pairs = [];
    for (var a = 0; a < n; a++) {
      var best = [-1, -1];
      var bd = [1e9, 1e9];
      for (var b = 0; b < n; b++) {
        if (b === a) continue;
        var dx = mx[a] - mx[b], dy = my[a] - my[b], dz = mz[a] - mz[b];
        var d = dx * dx + dy * dy + dz * dz;
        if (d < bd[0]) { bd[1] = bd[0]; best[1] = best[0]; bd[0] = d; best[0] = b; }
        else if (d < bd[1]) { bd[1] = d; best[1] = b; }
      }
      for (var k = 0; k < 2; k++) {
        if (best[k] < 0) continue;
        var lo = Math.min(a, best[k]), hi = Math.max(a, best[k]);
        pairs.push(lo * n + hi);
      }
    }

    pairs.sort(function (u, v) { return u - v; });
    var uniq = [];
    for (var q = 0; q < pairs.length; q++) {
      if (q === 0 || pairs[q] !== pairs[q - 1]) uniq.push(pairs[q]);
    }

    edgeCount = uniq.length;
    edgeA = new Int16Array(edgeCount);
    edgeB = new Int16Array(edgeCount);
    edgeK = new Float32Array(edgeCount);
    var seq = rng(77120);
    for (var e = 0; e < edgeCount; e++) {
      edgeA[e] = Math.floor(uniq[e] / n);
      edgeB[e] = uniq[e] % n;
      edgeK[e] = seq();
    }
  }

  function readColour(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  }

  function hex(c) {
    var s = c.replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function makeGlow(rgb) {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.5)');
    grad.addColorStop(0.45, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.16)');
    grad.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function syncTheme() {
    var m = parseFloat(readColour('--field-a', '1'));
    mul = isNaN(m) ? 1 : m;
    accents.signal = readColour('--signal', '#24D9BE');
    accents.pulse = readColour('--pulse', '#9B7BFF');
    accents.ember = readColour('--ember', '#E9A845');
    var s = hex(accents.signal), p = hex(accents.pulse);
    tone.sr = s[0]; tone.sg = s[1]; tone.sb = s[2];
    tone.pr = p[0]; tone.pg = p[1]; tone.pb = p[2];
    glows.signal = makeGlow(s);
    glows.pulse = makeGlow(p);
    glows.ember = makeGlow(hex(accents.ember));
  }

  function resize(w, h) {
    vw = w; vh = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(s) {
    var w = vw, h = vh;
    var fa = s.fa * mul;
    var fe = s.fe * mul;
    ctx.clearRect(0, 0, w, h);

    var list = api.cards;
    for (var ci = 0; ci < list.length; ci++) {
      var card = list[ci];
      if (card.rel === undefined || card.rel === 2) continue;
      var spill = parseFloat(card.el.style.getPropertyValue('--cd-spill') || '0');
      if (spill < 0.03) continue;
      var g = glows[card.accent] || glows.signal;
      var gw = card.w * 1.7;
      var gh = Math.max(card.h * 1.5, gw * 0.62);
      var gx = card.left + card.w * 0.5 - gw * 0.5;
      var gy = card.top - api.scrollPx + card.h * 0.5 - gh * 0.5;
      ctx.globalAlpha = spill * 0.42 * fa * 1.25;
      ctx.drawImage(g, gx, gy, gw, gh);
    }
    ctx.globalAlpha = 1;

    if (fa < 0.015) return;

    var cx = w * 0.5 + s.fx * w * 0.42;
    var cy = h * 0.5 + s.fy * h * 0.42;
    var R = Math.min(w, h) * 0.44 * s.fr;
    var ang = api.p * 2.4 + spin;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var ct = Math.cos(TILT), stt = Math.sin(TILT);
    var frag = s.fg;
    var zoff = s.cz / 260;
    var depth = s.fd;

    for (var i = 0; i < count; i++) {
      var x = mx[i], y = my[i], z = mz[i];
      if (frag > 0.001) {
        x += (sx[i] - x) * frag;
        y += (sy[i] - y) * frag;
        z += (sz[i] - z) * frag;
      }

      var rx = x * ca + z * sa;
      var rz = z * ca - x * sa;
      var ry = y * ct - rz * stt;
      var rz2 = rz * ct + y * stt;

      var den = FOCAL + (rz2 * 1.5 + zoff) * depth;
      if (den < 0.35) den = 0.35;
      var sc = FOCAL / den;

      px[i] = cx + rx * R * sc;
      py[i] = cy + ry * R * sc;
      ps[i] = sc;
    }

    var r = Math.round(tone.sr + (tone.pr - tone.sr) * s.ft);
    var gg = Math.round(tone.sg + (tone.pg - tone.sg) * s.ft);
    var b = Math.round(tone.sb + (tone.pb - tone.sb) * s.ft);
    var rgb = r + ',' + gg + ',' + b;

    if (fe > 0.008 && s.fl > 0.005) {
      ctx.lineWidth = 0.85;
      ctx.lineCap = 'round';
      for (var e = 0; e < edgeCount; e++) {
        var amt = (s.fl - edgeK[e] * 0.62) / 0.38;
        if (amt <= 0.02) continue;
        if (amt > 1) amt = 1;

        var a = edgeA[e], bb = edgeB[e];
        var sm = (ps[a] + ps[bb]) * 0.5;
        var alpha = fe * amt * Math.min(1, sm * 0.85);
        if (sm > 3) alpha *= Math.max(0, 1 - (sm - 3) * 0.4);
        if (alpha < 0.005) continue;

        ctx.strokeStyle = 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(px[a], py[a]);
        ctx.lineTo(px[a] + (px[bb] - px[a]) * amt, py[a] + (py[bb] - py[a]) * amt);
        ctx.stroke();
      }
    }

    order.sort(function (u, v) { return ps[u] - ps[v]; });

    for (var n = 0; n < count; n++) {
      var idx = order[n];
      var X = px[idx], Y = py[idx], S = ps[idx];
      if (X < -80 || X > w + 80 || Y < -80 || Y > h + 80) continue;

      var pa = fa * Math.min(1, 0.28 + S * 0.62);
      if (S > 3) pa *= Math.max(0, 1 - (S - 3) * 0.42);
      if (pa < 0.006) continue;

      var rad = 0.65 + S * 1.15;
      if (rad > 3.6) rad = 3.6;

      ctx.fillStyle = 'rgba(' + rgb + ',' + pa.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(X, Y, rad, 0, 6.2832);
      ctx.fill();
    }
  }

  function paint(stage) {
    if (!stage.vw || !stage.vh) return;

    if (stage.vw !== vw || stage.vh !== vh) {
      resize(stage.vw, stage.vh);
      var want = stage.vw < 760 ? 46 : 110;
      if (want !== count) build(want);
    }

    if (!stage.reduced) {
      var now = stage.time || 0;
      var dt = lastTime ? Math.min(now - lastTime, 60) : 16;
      lastTime = now;
      var weight = stage.p < 0.16 ? 1 : stage.p > 0.24 ? 0 : (0.24 - stage.p) / 0.08;
      spin += dt * 0.000055 * weight;
      stage.idle = weight > 0.001;
    } else {
      stage.idle = false;
    }

    draw(stage.state);

    if (!live) { live = true; canvas.classList.add('is-live'); }
  }

  syncTheme();
  build(window.innerWidth < 760 ? 46 : 110);
  resize(window.innerWidth, window.innerHeight);

  new MutationObserver(function () {
    syncTheme();
    api.wake();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  api.register(paint);
})();
