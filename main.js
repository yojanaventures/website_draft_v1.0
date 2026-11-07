/* ==========================================================
   Yojna Ventures: countdown page
   1. Countdown
   2. Dotted terrain background + rising eagle made of dots
   3. Logo light + tilt on hover / touch
   ========================================================== */

/* ---------- 1. Countdown ----------
   Change the launch moment here. Format: YYYY-MM-DDTHH:MM:SS+05:30 (IST). */
(function () {
  var LAUNCH = new Date('2027-05-14T00:00:00+05:30').getTime();

  var clock = document.getElementById('clock');
  var els = {
    days:    [document.getElementById('d-days'), 3],
    hours:   [document.getElementById('d-hours'), 2],
    minutes: [document.getElementById('d-minutes'), 2],
    seconds: [document.getElementById('d-seconds'), 2]
  };
  var lastMinute = -1;

  // Every digit lives in its own fixed-width cell so the clock never jitters.
  function paint(key, value) {
    var el = els[key][0];
    var s = String(value);
    while (s.length < els[key][1]) s = '0' + s;
    if (el.getAttribute('data-v') === s) return;
    el.setAttribute('data-v', s);
    el.innerHTML = s.split('').map(function (c) { return '<span class="d">' + c + '</span>'; }).join('');
  }

  function tick() {
    var diff = LAUNCH - Date.now();
    if (diff <= 0) {
      clearInterval(timer);
      clock.removeAttribute('aria-label');
      clock.style.display = 'block';
      clock.innerHTML = '<div class="live">We are open.</div>';
      return;
    }
    var s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;

    paint('days', d); paint('hours', h); paint('minutes', m); paint('seconds', sec);

    if (m !== lastMinute) {            // keep screen readers calm: update once a minute
      lastMinute = m;
      clock.setAttribute('aria-label', d + ' days, ' + h + ' hours and ' + m + ' minutes until launch');
    }
  }

  tick();
  var timer = setInterval(tick, 250);
})();


/* ---------- 2. Dotted terrain + rising eagle ----------
   The hills at the bottom and the eagle at the top are both made of dots.
   On load the eagle's dots lift off the hills and gather into an eagle in flight,
   then a small burst of sparks celebrates the launch. */
(function () {
  var cv = document.getElementById('terrain');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W, H, dpr, gap, cols, rows, top, baseY, rnd, jit;
  var pointer = { x: -9999, y: -9999 };
  var start = performance.now();
  var lastNow = start;
  var COLORS = ['#c1ff72', '#8fe05a', '#5ac249', '#2f8a2c'];

  /* ---------- eagle model ----------
     Unit coordinates: wingspan = 2 (x from -1 to 1), y grows downward, head at the top.
     The right wing is drawn once and mirrored. */
  var SHOULDER = [0.07, -0.12], ELBOW = [0.50, -0.10];
  var FING = [[-0.27, 1.04, -0.36], [-0.20, 1.05, -0.25], [-0.13, 1.02, -0.12], [-0.06, 0.98, 0.00], [0.01, 0.93, 0.12], [0.08, 0.86, 0.22]];
  function feather(k) {                               // one splayed primary feather of the wingtip
    var by = FING[k][0], tx = FING[k][1], ty = FING[k][2], bx = 0.78;
    var dx = tx - bx, dy = ty - by, L = Math.sqrt(dx * dx + dy * dy), px = -dy / L, py = dx / L, w0 = 0.036, w1 = 0.012;
    return [[bx + px * w0, by + py * w0], [tx + px * w1, ty + py * w1], [tx - px * w1, ty - py * w1], [bx - px * w0, by - py * w0]];
  }
  var SHAPES = {
    head:  [[0,-0.50],[0.03,-0.455],[0.056,-0.43],[0.06,-0.38],[0.045,-0.34],[-0.045,-0.34],[-0.06,-0.38],[-0.056,-0.43],[-0.03,-0.455]],
    body:  [[0.04,-0.35],[0.085,-0.28],[0.105,-0.10],[0.095,0.12],[0.06,0.30],[-0.06,0.30],[-0.095,0.12],[-0.105,-0.10],[-0.085,-0.28],[-0.04,-0.35]],
    tail:  [[-0.07,0.26],[0.07,0.26],[0.17,0.60],[0.10,0.66],[0,0.68],[-0.10,0.66],[-0.17,0.60]],
    inner: [[0.07,-0.18],[0.30,-0.22],[0.50,-0.20],[0.50,0.17],[0.38,0.21],[0.28,0.17],[0.18,0.20],[0.08,0.16]],
    hand:  [[0.50,-0.20],[0.78,-0.28],[0.78,0.12],[0.50,0.17]]
  };
  var eagle = { on: false, S: 0, cx: 0, cy: 0, dots: [] };
  var embers = [];
  var RISE_AT = 700, BURST_AT = 4500;

  function inPoly(x, y, p) {
    var c = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
      var xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  function area(p) {
    var a = 0;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
    return Math.abs(a) / 2;
  }

  function measureEagle() {
    var lg = document.getElementById('logo'), inf = document.querySelector('.info');
    if (!lg || !inf) { eagle.on = false; return; }
    var sy = window.pageYOffset || 0;
    var topC = Math.min(lg.getBoundingClientRect().top, inf.getBoundingClientRect().top) + sy;
    var avail = Math.max(0, topC - 22);
    var S = Math.min(avail / 1.3, W * 0.44, 290);
    var wasOn = eagle.on, oldS = eagle.S;
    eagle.on = S >= 66;
    eagle.cx = W / 2;
    eagle.cy = (avail / 2 + 11) - 0.09 * S;
    eagle.S = S;
    if (eagle.on && (!wasOn || Math.abs(S - oldS) > 4)) buildEagle();
  }

  function buildEagle() {
    var S = eagle.S, dots = [];
    var parts = [
      [SHAPES.head, 0, 1, -1], [SHAPES.body, 0, 1, -1], [SHAPES.tail, 0, 1, -1],
      [SHAPES.inner, 1, 1, -1], [SHAPES.inner, 1, -1, -1],
      [SHAPES.hand, 2, 1, -1], [SHAPES.hand, 2, -1, -1]
    ];
    for (var f = 0; f < FING.length; f++) {
      var fp = feather(f);
      parts.push([fp, 2, 1, f]);
      parts.push([fp, 2, -1, f]);
    }
    for (var k = 0; k < parts.length; k++) {
      var poly = parts[k][0], part = parts[k][1], side = parts[k][2], fk = parts[k][3];
      var n = Math.round(area(poly) * S * S / 12);
      var minx = 9, maxx = -9, miny = 9, maxy = -9, i;
      for (i = 0; i < poly.length; i++) {
        minx = Math.min(minx, poly[i][0]); maxx = Math.max(maxx, poly[i][0]);
        miny = Math.min(miny, poly[i][1]); maxy = Math.max(maxy, poly[i][1]);
      }
      var made = 0, guard = 0;
      while (made < n && guard++ < n * 40) {
        var x = minx + Math.random() * (maxx - minx), y = miny + Math.random() * (maxy - miny);
        if (!inPoly(x, y, poly)) continue;
        var ci = part === 0 ? (y < -0.33 ? 0 : 1) : part === 1 ? 2 : (x > 0.78 ? 0 : 1);
        dots.push({
          lx: x, ly: y, part: part, side: side, fk: fk, ci: ci,
          sx: Math.random(), sy: Math.random(),              // where the dot lifts off from the hills
          delay: Math.random() * 1500, dur: 1500 + Math.random() * 600,
          ph: Math.random() * 6.283, ox: 0, oy: 0
        });
        made++;
      }
    }
    eagle.dots = dots;
  }

  var rx = 0, ry = 0;                                   // result of rotAbout()
  function rotAbout(x, y, cx, cy, a) {
    var cs = Math.cos(a), sn = Math.sin(a), dx = x - cx, dy = y - cy;
    rx = cx + dx * cs - dy * sn; ry = cy + dx * sn + dy * cs;
  }
  function easeIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function ease(p) { return 1 - Math.pow(1 - p, 3); }

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    gap = W < 600 ? 6 : 7;
    cols = Math.ceil(W / gap) + 1;
    top = Math.floor(H * 0.45);
    rows = Math.ceil((H - top) / gap) + 1;
    baseY = H * (W < 992 ? 0.84 : 0.73);

    rnd = new Float32Array(cols * rows);
    jit = new Float32Array(cols * rows * 2);
    for (var i = 0; i < rnd.length; i++) {
      rnd[i] = Math.random();
      jit[i * 2] = (Math.random() - 0.5) * gap * 0.9;
      jit[i * 2 + 1] = (Math.random() - 0.5) * gap * 0.9;
    }

    eagle.S = 0; eagle.on = false;
    measureEagle();

    embers = [];
    for (var e = 0; e < (W < 600 ? 18 : 30); e++) embers.push({ x: Math.random() * W, f: Math.random(), sp: 0.05 + Math.random() * 0.06, ph: Math.random() * 6.283 });
  }

  // Peaky, layered ridge line, a bit like the hills in the logo.
  function ridge(x, t) {
    var a = Math.abs(Math.sin(x * 0.0042 + t * 0.00011)) - 0.5;
    var b = Math.abs(Math.sin(x * 0.0115 - t * 0.00017 + 1.3)) - 0.5;
    var c = Math.sin(x * 0.029 + t * 0.00031 + 0.4);
    return a * H * 0.1 + b * H * 0.05 + c * H * 0.006;
  }

  function drawTerrain(t, rise) {
    var lift = (1 - rise) * H * 0.4;
    var span = H - baseY + H * 0.05;
    var R = 120;

    for (var i = 0; i < cols; i++) {
      var x = i * gap;
      var rY = baseY + ridge(x, t) + lift;

      for (var j = 0; j < rows; j++) {
        var y = top + j * gap;
        var dd = y - rY;
        var dens;
        if (dd < 0) {
          dens = dd > -26 ? 0.42 * (1 + dd / 26) : 0;
        } else {
          var n = Math.min(1, dd / span);
          dens = 0.96 * Math.pow(1 - n, 1.7);
        }
        if (dens <= 0.01 || rnd[i * rows + j] > dens) continue;

        var n2 = dd < 0 ? 0 : Math.min(1, dd / span);
        var ci = n2 < 0.1 ? 0 : n2 < 0.28 ? 1 : n2 < 0.55 ? 2 : 3;
        var size = n2 < 0.2 ? 1.7 : 1.3;
        var k0 = (i * rows + j) * 2;
        var px = x + jit[k0], py = y + jit[k0 + 1], alpha = 0.95 - n2 * 0.45;

        var dx = px - pointer.x, dy = py - pointer.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          var d = Math.sqrt(d2) || 1;
          var k = 1 - d / R;
          var push = k * k * 30;
          px += (dx / d) * push;
          py += (dy / d) * push;
          ci = k > 0.45 ? 0 : Math.min(ci, 1);
          size += k * 1.3;
          alpha = Math.min(1, alpha + k * 0.5);
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = COLORS[ci];
        ctx.fillRect(px, py, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- intermittent eagle flight ----------
     The eagle is absent most of the time. It gathers from the dotted
     landscape, crosses the sky, and disappears above the frame. */
  var flightStart = -Infinity;
  var flightDuration = 2850;
  var nextFlightAt = start + 5500 + Math.random() * 4500;
  var audioContext = null;
  var audioReady = false;

  function unlockEagleAudio() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') audioContext.resume();
      audioReady = true;
    } catch (e) {}
  }

  // Soft, airy eagle-like call. Audio starts only after a user gesture
  // because browsers block unsolicited sound on page load.
  function eagleCry() {
    if (!audioReady || !audioContext || audioContext.state !== 'running') return;
    try {
      var nowAudio = audioContext.currentTime;
      var master = audioContext.createGain();
      var tone = audioContext.createOscillator();
      var overtone = audioContext.createOscillator();
      var breath = audioContext.createOscillator();
      var filter = audioContext.createBiquadFilter();
      var delay = audioContext.createDelay(0.5);
      var echo = audioContext.createGain();

      tone.type = 'sine';
      overtone.type = 'triangle';
      breath.type = 'sine';
      tone.frequency.setValueAtTime(760, nowAudio);
      tone.frequency.exponentialRampToValueAtTime(470, nowAudio + 0.72);
      tone.frequency.exponentialRampToValueAtTime(560, nowAudio + 1.08);
      overtone.frequency.setValueAtTime(1140, nowAudio);
      overtone.frequency.exponentialRampToValueAtTime(710, nowAudio + 1.05);
      breath.frequency.setValueAtTime(1850, nowAudio);
      breath.frequency.exponentialRampToValueAtTime(1250, nowAudio + 0.9);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2100, nowAudio);
      filter.Q.value = 0.7;
      master.gain.setValueAtTime(0.0001, nowAudio);
      master.gain.linearRampToValueAtTime(0.045, nowAudio + 0.18);
      master.gain.setValueAtTime(0.032, nowAudio + 0.58);
      master.gain.exponentialRampToValueAtTime(0.0001, nowAudio + 1.35);
      delay.delayTime.value = 0.19;
      echo.gain.value = 0.16;

      tone.connect(filter);
      overtone.connect(filter);
      breath.connect(filter);
      filter.connect(master);
      master.connect(audioContext.destination);
      master.connect(delay);
      delay.connect(echo);
      echo.connect(audioContext.destination);

      tone.start(nowAudio);
      overtone.start(nowAudio);
      breath.start(nowAudio);
      tone.stop(nowAudio + 1.4);
      overtone.stop(nowAudio + 1.4);
      breath.stop(nowAudio + 1.4);
      tone.onended = function () {
        try {
          tone.disconnect(); overtone.disconnect(); breath.disconnect();
          filter.disconnect(); master.disconnect(); delay.disconnect(); echo.disconnect();
        } catch (e) {}
      };
    } catch (e) {}
  }

  var gatherDuration = 1150;
  var holdDuration = 1450;
  var flyDuration = 2850;
  var totalFlightDuration = gatherDuration + holdDuration + flyDuration;
  var callPlayed = false;

  function launchFlight(now, withSound) {
    flightStart = now;
    callPlayed = false;
    nextFlightAt = now + totalFlightDuration + 5000 + Math.random() * 5000;
  }

  function drawEagle(now, t) {
    if (reduce || !eagle.on) return;
    if (now >= nextFlightAt) launchFlight(now, true);

    var elapsed = now - flightStart;
    if (elapsed < 0 || elapsed > totalFlightDuration) return;

    var S = Math.min(Math.max(78, Math.min(W * 0.25, 190)), eagle.S || 190);
    var targetX = W * 0.5;
    var targetY = H * 0.18;
    var gatherP = Math.min(1, elapsed / gatherDuration);
    var flyElapsed = elapsed - gatherDuration - holdDuration;
    var flying = flyElapsed > 0;
    var flyP = flying ? Math.min(1, flyElapsed / flyDuration) : 0;

    // Once the eagle has assembled, let it hover in place for a clear beat,
    // then give it a deliberate upward departure.
    if (!callPlayed && elapsed >= gatherDuration) {
      callPlayed = true;
      //eagleCry();
    }

    var gatherEase = easeIO(gatherP);
    var flyEase = easeIO(flyP);
    var fadeIn = Math.min(1, elapsed / 220);
    var fadeOut = flying ? Math.min(1, (flyDuration - flyElapsed) / 420) : 1;
    var visibility = Math.max(0, Math.min(fadeIn, fadeOut));
    var dots = eagle.dots;

    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var x = d.lx, y = d.ly;
      if (d.part === 2) {
        if (d.fk >= 0) {
          rotAbout(x, y, 0.78, FING[d.fk][0], Math.sin(t * 0.0021 + d.fk * 0.8) * 0.045);
          x = rx; y = ry;
        }
        rotAbout(x, y, ELBOW[0], ELBOW[1], -Math.sin(t * 0.0017) * 0.09);
        x = rx; y = ry;
      }
      if (d.part >= 1) {
        rotAbout(x, y, SHOULDER[0], SHOULDER[1], -Math.sin(t * 0.0017) * 0.04);
        x = rx; y = ry;
      }
      x *= d.side;
      var bx = x * S, by = y * S;
      var sourceX = W * (0.08 + d.sx * 0.84);
      var sourceY = baseY + 12 + d.sy * 70;
      var assembledX = targetX + bx;
      var assembledY = targetY + by;

      var px = sourceX + (assembledX - sourceX) * gatherEase;
      var py = sourceY + (assembledY - sourceY) * gatherEase;

      if (flying) {
        var exitDistance = H * 0.62 + Math.max(0, -by);
        py -= flyEase * exitDistance;
        px += Math.sin(flyP * Math.PI) * 22;
      }

      // A subtle living hover while the complete eagle pauses in the sky.
      if (elapsed >= gatherDuration && !flying) {
        py += Math.sin(now * 0.002 + d.ph) * 1.15;
      }

      var alpha = visibility * (0.78 + 0.22 * Math.sin(now * 0.002 + d.ph));
      var size = d.ci === 0 ? 2 : 1.55;
      var dx = px - pointer.x, dy = py - pointer.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < 95 * 95) {
        var dist = Math.sqrt(d2) || 1;
        var k = 1 - dist / 95;
        px += (dx / dist) * k * 10;
        py += (dy / dist) * k * 10;
        size += k;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS[d.ci];
      ctx.fillRect(px, py, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Hovering the central experience calls the eagle immediately.
  var flightZone = document.querySelector('.stage');
  if (flightZone) {
    flightZone.addEventListener('pointerenter', function () {
      unlockEagleAudio();
      launchFlight(performance.now(), true);
    });
    flightZone.addEventListener('pointerdown', unlockEagleAudio, { passive: true });
    flightZone.addEventListener('keydown', unlockEagleAudio);
  }
  window.addEventListener('keydown', unlockEagleAudio);
  window.addEventListener('pointerdown', unlockEagleAudio, { once: true, passive: true });

  // slow sparks that keep rising from the hills, like embers of a celebration
  function drawEmbers(now, dt) {
    var topY = H * 0.06, rangeY = baseY - topY;
    for (var i = 0; i < embers.length; i++) {
      var m = embers[i];
      m.f += m.sp * dt;
      if (m.f >= 1) { m.f = 0; m.x = Math.random() * W; }
      var y = baseY - m.f * rangeY;
      var x = m.x + Math.sin(now * 0.001 + m.ph) * 10;
      var a = Math.sin(Math.PI * m.f) * (0.55 + 0.35 * Math.sin(now * 0.004 + m.ph));
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = COLORS[0];
      ctx.fillRect(x, y, 1.8, 1.8);
    }
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    var dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    var t = reduce ? 4000 : now;
    var rise = reduce ? 1 : ease(Math.min(1, Math.max(0, (now - start - 500) / 2000)));

    ctx.clearRect(0, 0, W, H);
    drawTerrain(t, rise);
    drawEagle(now, t);
    if (!reduce) {
      if (now - start > 2500) drawEmbers(now, dt);
    }
  }

  var running = true;
  function loop(now) {
    if (!running) return;
    draw(now);
    requestAnimationFrame(loop);
  }

  build();
  // the layout can shift a little once fonts and the logo have loaded, so measure again
  window.addEventListener('load', function () { measureEagle(); });
  setTimeout(measureEagle, 2200);

  if (reduce) {
    draw(performance.now());
    window.addEventListener('resize', function () { build(); draw(performance.now()); });
    return;
  }

  window.addEventListener('resize', build);
  window.addEventListener('pointermove', function (e) { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  window.addEventListener('pointerleave', function () { pointer.x = pointer.y = -9999; });
  window.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch') pointer.x = pointer.y = -9999; });
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) { lastNow = performance.now(); requestAnimationFrame(loop); }
  });
  requestAnimationFrame(loop);
})();


/* ---------- 3. Logo light + tilt ---------- */
(function () {
  var logo = document.getElementById('logo');
  var tilt = document.getElementById('logoTilt');
  if (!logo || !tilt) return;
  var lit = tilt.querySelector('.logo-lit');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var userTouched = false;

  function light(px, py, opacity) {
    var r = logo.getBoundingClientRect();
    lit.style.setProperty('--lx', (px * r.width) + 'px');
    lit.style.setProperty('--ly', (py * r.height) + 'px');
    lit.style.setProperty('--lr', (r.width * 0.2) + 'px');
    lit.style.setProperty('--lo', opacity);
  }

  logo.addEventListener('pointermove', function (e) {
    userTouched = true;
    var r = logo.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width;
    var py = (e.clientY - r.top) / r.height;
    light(px, py, 1);
    if (!reduce) {
      tilt.style.transform = 'rotateY(' + ((px - 0.5) * 9).toFixed(2) + 'deg) rotateX(' + ((0.5 - py) * 7).toFixed(2) + 'deg)';
    }
  });

  function leave() {
    tilt.style.transform = '';
    lit.style.setProperty('--lo', 0);
  }
  logo.addEventListener('pointerleave', leave);
  logo.addEventListener('pointercancel', leave);

  // After the page loads, a single pass of light sweeps across the logo once,
  // so phones (no hover) get to see it too.
  if (!reduce) {
    setTimeout(function () {
      var t0 = performance.now(), dur = 1800;
      (function sweep(now) {
        if (userTouched) return;
        var p = Math.min(1, (now - t0) / dur);
        light(-0.1 + 1.2 * p, 0.55, Math.sin(Math.PI * p));
        if (p < 1) requestAnimationFrame(sweep);
      })(t0);
    }, 1300);
  }
})();
