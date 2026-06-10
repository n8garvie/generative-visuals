/*
 * Particle Surface Studio
 *
 * Renders a 3D parametric surface as a dense lattice of tiny dots, drawn in
 * two slightly offset color passes (red/blue). The regular grid produces
 * moiré interference rings; per-dot jitter trades the moiré for grain; the
 * pass offset produces chromatic fringing on the rims. The Copies group
 * repeats the surface with per-copy rotation/scale/color variation.
 *
 * Animation: a lava-lamp loop plays by default. Every modulation (a wave
 * traveling around the surface, rotation sway, amplitude/zoom breathing,
 * jitter/chroma shimmer) is a periodic function of a single phase that runs
 * 0..2π over one loop, so the loop is seamless and all mods are the identity
 * at phase 0. Loops export as GIF (offline, full density, via gif.js) or
 * WebM (realtime MediaRecorder capture).
 */

(() => {
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);

  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');

  // Fixed internal resolution, 4:5 like the reference images. CSS scales it
  // to fit the stage; exports come out at this size.
  const W = 1000;
  const H = 1250;
  canvas.width = W;
  canvas.height = H;

  // Shapes are drawn to an offscreen layer, then composited (and optionally
  // mirrored) over the background.
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const offCtx = off.getContext('2d');

  // ---------------------------------------------------------------- params

  const PARAM_DEFS = [
    { key: 'lobesU', label: 'Lobes U', min: 0, max: 12, step: 1, def: 3, group: 'shape' },
    { key: 'lobesV', label: 'Lobes V', min: 0, max: 8, step: 1, def: 2, group: 'shape' },
    { key: 'amp', label: 'Amplitude', min: 0, max: 1, step: 0.01, def: 0.55, group: 'shape' },
    { key: 'smooth', label: 'Smoothing', min: 0, max: 1, step: 0.01, def: 0.55, group: 'shape' },
    { key: 'twist', label: 'Twist', min: -3, max: 3, step: 0.05, def: 1.2, group: 'shape' },
    { key: 'sx', label: 'Stretch X', min: 0.1, max: 2, step: 0.01, def: 1, group: 'shape' },
    { key: 'sy', label: 'Stretch Y', min: 0.1, max: 2, step: 0.01, def: 1, group: 'shape' },
    { key: 'sz', label: 'Stretch Z', min: 0.1, max: 2, step: 0.01, def: 1, group: 'shape' },

    { key: 'rotX', label: 'Rotate X', min: -180, max: 180, step: 1, def: -20, group: 'view' },
    { key: 'rotY', label: 'Rotate Y', min: -180, max: 180, step: 1, def: 30, group: 'view' },
    { key: 'rotZ', label: 'Rotate Z', min: -180, max: 180, step: 1, def: 10, group: 'view' },
    { key: 'zoom', label: 'Zoom', min: 0.3, max: 2.5, step: 0.01, def: 1.1, group: 'view' },

    { key: 'copies', label: 'Copies', min: 1, max: 5, step: 1, def: 1, group: 'copies' },
    { key: 'spread', label: 'Spread', min: 0, max: 0.6, step: 0.01, def: 0.3, group: 'copies' },
    { key: 'rotStep', label: 'Turn step', min: -90, max: 90, step: 1, def: 0, group: 'copies' },
    { key: 'scaleStep', label: 'Scale step', min: 0.7, max: 1.3, step: 0.01, def: 1, group: 'copies' },

    { key: 'density', label: 'Density', min: 80, max: 700, step: 10, def: 520, group: 'texture' },
    { key: 'gridRatio', label: 'Grid ratio', min: 0.25, max: 4, step: 0.05, def: 1, group: 'texture' },
    { key: 'dotSize', label: 'Dot size', min: 0.5, max: 3, step: 0.1, def: 1.4, group: 'texture' },
    { key: 'dotAlpha', label: 'Dot alpha', min: 0.05, max: 1, step: 0.01, def: 0.75, group: 'texture' },
    { key: 'jitter', label: 'Jitter', min: 0, max: 8, step: 0.05, def: 0.4, group: 'texture' },
    { key: 'chromaOff', label: 'Chroma off', min: 0, max: 14, step: 0.1, def: 5, group: 'texture' },
    { key: 'chromaAngle', label: 'Chroma ang', min: 0, max: 360, step: 1, def: 200, group: 'texture' },
    { key: 'depthTint', label: 'Depth tint', min: 0, max: 1, step: 0.01, def: 0.7, group: 'texture' },
    { key: 'gradAmt', label: 'Gradient', min: 0, max: 1.5, step: 0.01, def: 0, group: 'texture' },
    { key: 'gradAngle', label: 'Grad angle', min: 0, max: 360, step: 1, def: 90, group: 'texture' },
    { key: 'sparkle', label: 'Sparkle', min: 0, max: 0.1, step: 0.002, def: 0, group: 'texture' },

    { key: 'loopSec', label: 'Loop (sec)', min: 1, max: 30, step: 0.5, def: 5, group: 'anim' },
    { key: 'morph', label: 'Morph', min: 0, max: 1, step: 0.01, def: 0.6, group: 'anim' },
    { key: 'sway', label: 'Sway', min: 0, max: 30, step: 0.5, def: 6, group: 'anim' },
    { key: 'breathe', label: 'Breathe', min: 0, max: 0.3, step: 0.005, def: 0.08, group: 'anim' },
  ];

  const PRESETS = {
    shell: {
      lobesU: 1, lobesV: 3, amp: 0.9, smooth: 0.6, twist: 1.4, sx: 1, sy: 1, sz: 1,
      rotX: -40, rotY: 60, rotZ: 15, zoom: 1,
      copies: 1, spread: 0.3, rotStep: 0, scaleStep: 1, alternate: false, sparkle: 0, mirror: 'off',
      density: 700, gridRatio: 1.8, dotSize: 1.15, dotAlpha: 0.8, jitter: 0.2,
      chromaOff: 3, chromaAngle: 200, depthTint: 0.6, gradAmt: 0, gradAngle: 90,
    },
    flower: {
      lobesU: 5, lobesV: 3, amp: 0.4, smooth: 0.6, twist: 0.6, sx: 1, sy: 1, sz: 1,
      rotX: -55, rotY: 0, rotZ: 25, zoom: 1.15,
      copies: 1, spread: 0.3, rotStep: 0, scaleStep: 1, alternate: false, sparkle: 0.02, mirror: 'off',
      density: 600, gridRatio: 1.8, dotSize: 1.1, dotAlpha: 0.6, jitter: 0.2,
      chromaOff: 3, chromaAngle: 150, depthTint: 0.7, gradAmt: 0, gradAngle: 90,
    },
    ellipse: {
      lobesU: 0, lobesV: 0, amp: 0, smooth: 0, twist: 0, sx: 0.27, sy: 0.3, sz: 1.35,
      rotX: 0, rotY: 0, rotZ: 0, zoom: 1.35,
      copies: 3, spread: 0.31, rotStep: 0, scaleStep: 1.05, alternate: true, sparkle: 0, mirror: 'off',
      density: 540, gridRatio: 1, dotSize: 1.3, dotAlpha: 0.8, jitter: 3,
      chromaOff: 8, chromaAngle: 160, depthTint: 0.15, gradAmt: 0.35, gradAngle: 75,
    },
    mesh: {
      lobesU: 0, lobesV: 0, amp: 0, smooth: 0, twist: 0, sx: 0.55, sy: 0.4, sz: 1.5,
      rotX: 0, rotY: 0, rotZ: 0, zoom: 1.25,
      copies: 1, spread: 0.3, rotStep: 0, scaleStep: 1, alternate: false, sparkle: 0, mirror: 'off',
      density: 600, gridRatio: 1, dotSize: 0.9, dotAlpha: 0.55, jitter: 0,
      chromaOff: 9, chromaAngle: 250, depthTint: 0.25, gradAmt: 0.6, gradAngle: 100,
    },
    blob: {
      lobesU: 2, lobesV: 2, amp: 0.3, smooth: 0.55, twist: 2.2, sx: 1, sy: 0.8, sz: 1.1,
      rotX: 35, rotY: -40, rotZ: 0, zoom: 1.1,
      copies: 1, spread: 0.3, rotStep: 0, scaleStep: 1, alternate: false, sparkle: 0, mirror: 'off',
      density: 560, gridRatio: 1.5, dotSize: 1.3, dotAlpha: 0.6, jitter: 1,
      chromaOff: 6, chromaAngle: 60, depthTint: 0.45, gradAmt: 0.3, gradAngle: 0,
    },
  };

  const state = {
    params: Object.fromEntries(PARAM_DEFS.map((d) => [d.key, d.def])),
    seed: 1234,
  };

  // ----------------------------------------------------------------- utils

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------------- UI

  const sliderEls = {};

  function buildSliders() {
    const containers = {
      shape: $('shape-controls'),
      view: $('view-controls'),
      copies: $('copies-controls'),
      texture: $('texture-controls'),
      anim: $('anim-controls'),
    };
    for (const def of PARAM_DEFS) {
      const row = document.createElement('label');
      row.className = 'row';

      const name = document.createElement('span');
      name.textContent = def.label;

      const input = document.createElement('input');
      input.type = 'range';
      input.min = def.min;
      input.max = def.max;
      input.step = def.step;
      input.value = def.def;

      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = def.def;

      input.addEventListener('input', () => {
        state.params[def.key] = parseFloat(input.value);
        val.textContent = input.value;
        scheduleRender(true);
      });
      input.addEventListener('change', () => scheduleRender(false));

      row.append(name, input, val);
      containers[def.group].appendChild(row);
      sliderEls[def.key] = { input, val };
    }
  }

  function syncUI() {
    for (const def of PARAM_DEFS) {
      const v = state.params[def.key];
      sliderEls[def.key].input.value = v;
      sliderEls[def.key].val.textContent = String(v);
    }
  }

  // --------------------------------------------------------------- render

  let rafPending = false;
  let pendingPreview = false;

  function scheduleRender(preview) {
    if (playing || exporting) return; // the animation/export loop owns the canvas
    // A queued full render must not be downgraded by a later preview request.
    pendingPreview = rafPending ? pendingPreview && preview : preview;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const preview_ = pendingPreview;
      pendingPreview = false;
      render(preview_, animMod(phase));
    });
  }

  // Draws one surface instance onto g. colA is the front/top color, colB the
  // offset back color. mod carries the animation-loop modulation (see animMod).
  function drawSurface(g, p, rnd, preview, cx, rotY, zoom, colA, colB, mod) {
    const dens = preview ? Math.max(60, Math.round(p.density * 0.45)) : p.density;
    const nu = dens;
    // gridRatio > 1 thins the v sampling, leaving visible dotted rows.
    const nv = Math.max(20, Math.round((dens * 0.75) / p.gridRatio));
    const n = nu * nv;

    const cy = H / 2;
    const scale = Math.min(W, H) * 0.31 * zoom;
    const persp = 5;

    const ph = mod.phase ?? 0;
    const morph = mod.morph ?? 0;
    const ampl = p.amp * (mod.ampMul ?? 1);

    // Smoothing rounds the shape two ways: a tanh soft-saturation blunts the
    // pointy lobe tips (the wave's peaks flatten gently instead of cresting
    // sharply), and a smooth-max floor on the radius stops the surface from
    // pinching through the centre, which is what creates hard cusps and
    // creases in the silhouette.
    const sm = p.smooth;
    const satG = 2.5 * sm;
    const satNorm = sm ? 1 / Math.tanh(satG) : 0;
    const pinch = 0.5 * sm;

    const ax = ((p.rotX + (mod.swayX ?? 0)) * Math.PI) / 180;
    const ay = (rotY * Math.PI) / 180;
    const az = (p.rotZ * Math.PI) / 180;
    const cxr = Math.cos(ax), sxr = Math.sin(ax);
    const cyr = Math.cos(ay), syr = Math.sin(ay);
    const czr = Math.cos(az), szr = Math.sin(az);

    // Pass 1: compute projected points + depth range.
    const pts = new Float32Array(n * 3);
    let dMin = Infinity;
    let dMax = -Infinity;
    let i = 0;
    for (let iu = 0; iu < nu; iu++) {
      const u = (iu / nu) * TAU;
      for (let iv = 0; iv < nv; iv++) {
        const v = (iv / (nv - 1)) * Math.PI;
        const sv = Math.sin(v);

        // Morph crossfades the lobe wave toward a copy whose phase travels a
        // full 2π over one loop, so the lobes flow around the surface like
        // rising lava and land exactly back on the static shape.
        const base = p.lobesU * u + p.twist * v;
        let wave = morph
          ? (1 - morph) * Math.sin(base) + morph * Math.sin(base - ph)
          : Math.sin(base);
        if (sm) wave = Math.tanh(satG * wave) * satNorm;
        let r = 1 + ampl * wave * Math.sin(p.lobesV * v);
        if (sm) r = (r + Math.sqrt(r * r + pinch * pinch)) / 2;
        const x = r * p.sx * sv * Math.cos(u);
        const y = r * p.sy * sv * Math.sin(u);
        const z = r * p.sz * Math.cos(v);

        // rotate X, then Y, then Z
        const y1 = y * cxr - z * sxr;
        let z1 = y * sxr + z * cxr;
        const x1 = x * cyr + z1 * syr;
        z1 = -x * syr + z1 * cyr;
        const x2 = x1 * czr - y1 * szr;
        const y2 = x1 * szr + y1 * czr;

        // y2 is depth (positive = away from viewer); screen y is -z1
        const f = persp / (persp + y2);
        pts[i * 3] = cx + x2 * scale * f;
        pts[i * 3 + 1] = cy - z1 * scale * f;
        pts[i * 3 + 2] = y2;
        if (y2 < dMin) dMin = y2;
        if (y2 > dMax) dMax = y2;
        i++;
      }
    }
    const dRange = Math.max(dMax - dMin, 1e-6);

    // Pass 2: every dot stays PURE colorA or colorB — mid-tones come from
    // stochastic dithering (probability of B rises toward the back and along
    // the gradient direction), so mixed regions read as vivid optical
    // grey-blue instead of muddy blended purple. Pass 1 leans toward colorA
    // (front), the chroma-offset pass 2 toward colorB (back).
    const posA = [];
    const posB = [];
    const posC = []; // rare accent-color dots
    const chroma = p.chromaOff * (mod.chromaMul ?? 1);
    const ox = Math.cos((p.chromaAngle * Math.PI) / 180) * chroma;
    const oy = Math.sin((p.chromaAngle * Math.PI) / 180) * chroma;
    const ga = (p.gradAngle * Math.PI) / 180;
    const gx = (Math.cos(ga) * p.gradAmt) / (2 * scale);
    const gy = (Math.sin(ga) * p.gradAmt) / (2 * scale);
    const jit = p.jitter + (mod.jitterAdd ?? 0);
    const spk = p.sparkle;

    for (let k = 0; k < n; k++) {
      // rnd is always consumed (even at jit 0) so every animation frame sees
      // the same per-dot random stream — otherwise the dither pattern would
      // pop on frames where the animated jitter crosses zero.
      const jx = (rnd() + rnd() + rnd() - 1.5) * jit;
      const jy = (rnd() + rnd() + rnd() - 1.5) * jit;
      const x = pts[k * 3] + jx;
      const y = pts[k * 3 + 1] + jy;
      const t = 1 - (pts[k * 3 + 2] - dMin) / dRange; // 1 = front, 0 = back

      const gr = (x - cx) * gx + (y - cy) * gy;
      const f1 = p.depthTint * (1 - t) + gr;
      const f2 = 1 - p.depthTint * t + gr;
      if (spk && rnd() < spk) posC.push(x, y);
      else (rnd() < f1 ? posB : posA).push(x, y);
      (rnd() < f2 ? posB : posA).push(x + ox, y + oy);
    }

    const s = p.dotSize;
    g.globalAlpha = p.dotAlpha;
    // colB underneath, colA (front) on top, accent sparkle above both.
    g.fillStyle = colB;
    for (let j = 0; j < posB.length; j += 2) g.fillRect(posB[j], posB[j + 1], s, s);
    g.fillStyle = colA;
    for (let j = 0; j < posA.length; j += 2) g.fillRect(posA[j], posA[j + 1], s, s);
    if (posC.length) {
      g.globalAlpha = Math.min(1, p.dotAlpha * 1.5);
      g.fillStyle = $('colorC').value;
      for (let j = 0; j < posC.length; j += 2) g.fillRect(posC[j], posC[j + 1], s, s);
    }
    g.globalAlpha = 1;
  }

  function render(preview, mod = {}) {
    const p = state.params;
    const rnd = mulberry32(state.seed);

    offCtx.clearRect(0, 0, W, H);

    const copies = Math.round(p.copies);
    const alternate = $('alternate').checked;
    const colA = $('colorA').value;
    const colB = $('colorB').value;

    for (let c = 0; c < copies; c++) {
      const cx = W / 2 + (c - (copies - 1) / 2) * p.spread * W;
      const rotY = p.rotY + (mod.swayY ?? 0) + p.rotStep * c;
      const zoom = p.zoom * (mod.zoomMul ?? 1) * Math.pow(p.scaleStep, c);
      const swap = alternate && c % 2 === 1;
      drawSurface(offCtx, p, rnd, preview, cx, rotY, zoom, swap ? colB : colA, swap ? colA : colB, mod);
    }

    // Composite the shape layer over the background, with optional mirrors.
    ctx.globalAlpha = 1;
    ctx.fillStyle = $('colorBg').value;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0);
    const mirror = $('mirror').value;
    if (mirror === 'x' || mirror === 'quad') {
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(off, 0, 0);
      ctx.restore();
    }
    if (mirror === 'y' || mirror === 'quad') {
      ctx.save();
      ctx.translate(0, H);
      ctx.scale(1, -1);
      ctx.drawImage(off, 0, 0);
      ctx.restore();
    }
    if (mirror === 'quad') {
      ctx.save();
      ctx.translate(W, H);
      ctx.scale(-1, -1);
      ctx.drawImage(off, 0, 0);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------- animation

  let playing = false;
  let exporting = false;
  let phase = 0; // current loop phase, 0..TAU
  let lastTick = 0;

  // All modulations are periodic in phase and the identity at phase 0, so a
  // paused-at-zero frame matches the static render and the loop is seamless.
  function animMod(ph) {
    const p = state.params;
    return {
      phase: ph,
      morph: p.morph,
      ampMul: 1 + p.breathe * Math.sin(ph),
      zoomMul: 1 - 0.3 * p.breathe * Math.sin(ph),
      swayX: p.sway * Math.sin(ph),
      swayY: p.sway * 0.7 * (1 - Math.cos(ph)),
      jitterAdd: 5 * p.breathe * (1 - Math.cos(ph)),
      chromaMul: 1 + 4 * p.breathe * Math.sin(2 * ph),
    };
  }

  function tick(now) {
    if (!playing) return;
    phase = (phase + ((now - lastTick) / (state.params.loopSec * 1000)) * TAU) % TAU;
    lastTick = now;
    render(true, animMod(phase));
    requestAnimationFrame(tick);
  }

  function setPlaying(on) {
    if (exporting) return;
    playing = on;
    const btn = $('play');
    btn.classList.toggle('on', on);
    btn.textContent = on ? 'Pause' : 'Play';
    if (on) {
      lastTick = performance.now();
      requestAnimationFrame(tick);
    } else {
      scheduleRender(false); // full-quality frame, frozen at the current phase
    }
  }

  // -------------------------------------------------------------- actions

  function applyPreset(name) {
    const { alternate, mirror, ...params } = PRESETS[name];
    Object.assign(state.params, params);
    $('alternate').checked = alternate;
    $('mirror').value = mirror;
    syncUI();
    scheduleRender(false);
  }

  function randomize() {
    state.seed = (Math.random() * 1e9) >>> 0;
    const rnd = mulberry32(state.seed);
    const ri = (lo, hi) => Math.round(lo + rnd() * (hi - lo));
    const rf = (lo, hi, dp = 2) => +(lo + rnd() * (hi - lo)).toFixed(dp);
    Object.assign(state.params, {
      lobesU: ri(1, 8),
      lobesV: ri(1, 5),
      amp: rf(0.1, 0.7),
      smooth: rf(0.25, 0.85),
      twist: rf(-2.5, 2.5),
      sx: rf(0.5, 1.4),
      sy: rf(0.5, 1.4),
      sz: rf(0.5, 1.4),
      rotX: ri(-90, 90),
      rotY: ri(-90, 90),
      rotZ: ri(-90, 90),
      rotStep: ri(-45, 45),
      jitter: rf(0, 3),
      gridRatio: rf(0.5, 3),
      chromaOff: rf(2, 10, 1),
      chromaAngle: ri(0, 360),
      depthTint: rf(0.1, 0.9),
      gradAmt: rf(0, 0.8),
      gradAngle: ri(0, 360),
      sparkle: rnd() < 0.4 ? rf(0.004, 0.04, 3) : 0,
    });
    syncUI();
    scheduleRender(false);
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function setStatus(msg) {
    $('status').textContent = msg;
  }

  function exportPng() {
    if (exporting) return;
    render(false, animMod(phase));
    canvas.toBlob((blob) => download(blob, `visual-${Date.now()}.png`));
  }

  // Renders every frame of one loop offline at full density, half resolution
  // (500×625), 20 fps, and encodes with gif.js. Deterministic and seamless.
  async function exportGif() {
    if (exporting) return;
    exporting = true;
    const wasPlaying = playing;
    playing = false;
    const fps = 20; // GIF frame delay of exactly 5 centiseconds
    const frames = Math.max(4, Math.round(state.params.loopSec * fps));
    const gw = W / 2;
    const gh = H / 2;
    const gifCanvas = document.createElement('canvas');
    gifCanvas.width = gw;
    gifCanvas.height = gh;
    const gctx = gifCanvas.getContext('2d', { willReadFrequently: true });
    const enc = createGifEncoder(gw, gh, 100 / fps);
    try {
      for (let f = 0; f < frames; f++) {
        setStatus(`GIF: rendering frame ${f + 1}/${frames}…`);
        render(false, animMod((f / frames) * TAU));
        gctx.drawImage(canvas, 0, 0, gw, gh);
        enc.addFrame(gctx.getImageData(0, 0, gw, gh).data);
        await new Promise((r) => setTimeout(r, 0)); // let the UI update
      }
      download(enc.finish(), `visual-${Date.now()}.gif`);
    } finally {
      setStatus('');
      exporting = false;
      if (wasPlaying) setPlaying(true);
      else scheduleRender(false);
    }
  }

  // Records exactly one loop of the live animation in real time via
  // MediaRecorder, starting from the current phase so the file is seamless.
  function exportVideo() {
    if (exporting) return;
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      setStatus('Video export is not supported in this browser.');
      return;
    }
    exporting = true;
    const wasPlaying = playing;
    playing = false;
    const loopMs = state.params.loopSec * 1000;
    const stream = canvas.captureStream(30);
    const mime = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4']
      .find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const ext = rec.mimeType.includes('mp4') ? 'mp4' : 'webm';
      download(new Blob(chunks, { type: rec.mimeType }), `visual-${Date.now()}.${ext}`);
      setStatus('');
      exporting = false;
      if (wasPlaying) setPlaying(true);
      else scheduleRender(false);
    };
    rec.start();
    const t0 = performance.now();
    const vloop = (now) => {
      const elapsed = now - t0;
      if (elapsed >= loopMs) {
        rec.stop();
        return;
      }
      setStatus(`Recording: ${(elapsed / 1000).toFixed(1)} / ${state.params.loopSec}s`);
      render(true, animMod((phase + (elapsed / loopMs) * TAU) % TAU));
      requestAnimationFrame(vloop);
    };
    requestAnimationFrame(vloop);
  }

  // ----------------------------------------------------------------- init

  buildSliders();
  // Console/scripting access: studio.state.params, studio.render(), etc.
  window.studio = { state, render: () => scheduleRender(false), syncUI, applyPreset, randomize, setPlaying, exportGif, exportVideo };
  $('preset').addEventListener('change', (e) => applyPreset(e.target.value));
  $('randomize').addEventListener('click', randomize);
  $('export').addEventListener('click', exportPng);
  $('export-gif').addEventListener('click', exportGif);
  $('export-video').addEventListener('click', exportVideo);
  $('play').addEventListener('click', () => setPlaying(!playing));
  $('fullscreen').addEventListener('click', () => {
    const on = document.body.classList.toggle('fullscreen');
    $('fullscreen').setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
  });
  $('alternate').addEventListener('change', () => scheduleRender(false));
  $('mirror').addEventListener('change', () => scheduleRender(false));
  for (const id of ['colorA', 'colorB', 'colorC', 'colorBg']) {
    $(id).addEventListener('input', () => scheduleRender(true));
    $(id).addEventListener('change', () => scheduleRender(false));
  }

  applyPreset($('preset').value);
  setPlaying(true); // the lava-lamp loop plays by default
})();
