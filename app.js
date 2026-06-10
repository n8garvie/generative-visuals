/*
 * Particle Surface Studio
 *
 * Renders a 3D parametric surface as a dense lattice of tiny dots, drawn in
 * two slightly offset color passes (red/blue). The regular grid produces
 * moiré interference rings; per-dot jitter trades the moiré for grain; the
 * pass offset produces chromatic fringing on the rims.
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

  // ---------------------------------------------------------------- params

  const PARAM_DEFS = [
    { key: 'lobesU', label: 'Lobes U', min: 0, max: 12, step: 1, def: 3, group: 'shape' },
    { key: 'lobesV', label: 'Lobes V', min: 0, max: 8, step: 1, def: 2, group: 'shape' },
    { key: 'amp', label: 'Amplitude', min: 0, max: 1, step: 0.01, def: 0.55, group: 'shape' },
    { key: 'twist', label: 'Twist', min: -3, max: 3, step: 0.05, def: 1.2, group: 'shape' },
    { key: 'sx', label: 'Stretch X', min: 0.1, max: 2, step: 0.01, def: 1, group: 'shape' },
    { key: 'sy', label: 'Stretch Y', min: 0.1, max: 2, step: 0.01, def: 1, group: 'shape' },
    { key: 'sz', label: 'Stretch Z', min: 0.1, max: 2, step: 0.01, def: 1, group: 'shape' },

    { key: 'rotX', label: 'Rotate X', min: -180, max: 180, step: 1, def: -20, group: 'view' },
    { key: 'rotY', label: 'Rotate Y', min: -180, max: 180, step: 1, def: 30, group: 'view' },
    { key: 'rotZ', label: 'Rotate Z', min: -180, max: 180, step: 1, def: 10, group: 'view' },
    { key: 'zoom', label: 'Zoom', min: 0.3, max: 2.5, step: 0.01, def: 1.1, group: 'view' },

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
  ];

  const PRESETS = {
    shell: {
      lobesU: 1, lobesV: 3, amp: 0.9, twist: 1.4, sx: 1, sy: 1, sz: 1,
      rotX: -40, rotY: 60, rotZ: 15, zoom: 1,
      density: 700, gridRatio: 1.8, dotSize: 1.15, dotAlpha: 0.8, jitter: 0.2,
      chromaOff: 3, chromaAngle: 200, depthTint: 0.6, gradAmt: 0, gradAngle: 90,
    },
    flower: {
      lobesU: 5, lobesV: 3, amp: 0.4, twist: 0.6, sx: 1, sy: 1, sz: 1,
      rotX: -55, rotY: 0, rotZ: 25, zoom: 1.15,
      density: 600, gridRatio: 1.8, dotSize: 1.1, dotAlpha: 0.6, jitter: 0.2,
      chromaOff: 3, chromaAngle: 150, depthTint: 0.7, gradAmt: 0, gradAngle: 90,
    },
    ellipse: {
      lobesU: 0, lobesV: 0, amp: 0, twist: 0, sx: 0.5, sy: 0.35, sz: 1.45,
      rotX: 0, rotY: 0, rotZ: 0, zoom: 1.25,
      density: 640, gridRatio: 1, dotSize: 1.3, dotAlpha: 0.8, jitter: 3,
      chromaOff: 8, chromaAngle: 160, depthTint: 0.15, gradAmt: 0.35, gradAngle: 75,
    },
    mesh: {
      lobesU: 0, lobesV: 0, amp: 0, twist: 0, sx: 0.55, sy: 0.4, sz: 1.5,
      rotX: 0, rotY: 0, rotZ: 0, zoom: 1.25,
      density: 600, gridRatio: 1, dotSize: 0.9, dotAlpha: 0.55, jitter: 0,
      chromaOff: 9, chromaAngle: 250, depthTint: 0.25, gradAmt: 0.6, gradAngle: 100,
    },
    blob: {
      lobesU: 2, lobesV: 2, amp: 0.3, twist: 2.2, sx: 1, sy: 0.8, sz: 1.1,
      rotX: 35, rotY: -40, rotZ: 0, zoom: 1.1,
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
      texture: $('texture-controls'),
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
    // A queued full render must not be downgraded by a later preview request.
    pendingPreview = rafPending ? pendingPreview && preview : preview;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const preview_ = pendingPreview;
      pendingPreview = false;
      render(preview_);
    });
  }

  function render(preview) {
    const p = state.params;
    const rnd = mulberry32(state.seed);

    ctx.globalAlpha = 1;
    ctx.fillStyle = $('colorBg').value;
    ctx.fillRect(0, 0, W, H);

    const dens = preview ? Math.max(60, Math.round(p.density * 0.45)) : p.density;
    const nu = dens;
    // gridRatio > 1 thins the v sampling, leaving visible dotted rows.
    const nv = Math.max(20, Math.round((dens * 0.75) / p.gridRatio));
    const n = nu * nv;

    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) * 0.31 * p.zoom;
    const persp = 5;

    const ax = (p.rotX * Math.PI) / 180;
    const ay = (p.rotY * Math.PI) / 180;
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

        const r = 1 + p.amp * Math.sin(p.lobesU * u + p.twist * v) * Math.sin(p.lobesV * v);
        let x = r * p.sx * sv * Math.cos(u);
        let y = r * p.sy * sv * Math.sin(u);
        let z = r * p.sz * Math.cos(v);

        // rotate X, then Y, then Z
        let y1 = y * cxr - z * sxr;
        let z1 = y * sxr + z * cxr;
        let x1 = x * cyr + z1 * syr;
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
    const ox = Math.cos((p.chromaAngle * Math.PI) / 180) * p.chromaOff;
    const oy = Math.sin((p.chromaAngle * Math.PI) / 180) * p.chromaOff;
    const ga = (p.gradAngle * Math.PI) / 180;
    const gx = (Math.cos(ga) * p.gradAmt) / (2 * scale);
    const gy = (Math.sin(ga) * p.gradAmt) / (2 * scale);
    const jit = p.jitter;

    for (let k = 0; k < n; k++) {
      const jx = jit ? (rnd() + rnd() + rnd() - 1.5) * jit : 0;
      const jy = jit ? (rnd() + rnd() + rnd() - 1.5) * jit : 0;
      const x = pts[k * 3] + jx;
      const y = pts[k * 3 + 1] + jy;
      const t = 1 - (pts[k * 3 + 2] - dMin) / dRange; // 1 = front, 0 = back

      const g = (x - cx) * gx + (y - cy) * gy;
      const f1 = p.depthTint * (1 - t) + g;
      const f2 = 1 - p.depthTint * t + g;
      (rnd() < f1 ? posB : posA).push(x, y);
      (rnd() < f2 ? posB : posA).push(x + ox, y + oy);
    }

    const s = p.dotSize;
    ctx.globalAlpha = p.dotAlpha;
    // colorB underneath, colorA (front/red) on top.
    ctx.fillStyle = $('colorB').value;
    for (let j = 0; j < posB.length; j += 2) ctx.fillRect(posB[j], posB[j + 1], s, s);
    ctx.fillStyle = $('colorA').value;
    for (let j = 0; j < posA.length; j += 2) ctx.fillRect(posA[j], posA[j + 1], s, s);
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------- actions

  function applyPreset(name) {
    Object.assign(state.params, PRESETS[name]);
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
      twist: rf(-2.5, 2.5),
      sx: rf(0.5, 1.4),
      sy: rf(0.5, 1.4),
      sz: rf(0.5, 1.4),
      rotX: ri(-90, 90),
      rotY: ri(-90, 90),
      rotZ: ri(-90, 90),
      jitter: rf(0, 3),
      gridRatio: rf(0.5, 3),
      chromaOff: rf(2, 10, 1),
      chromaAngle: ri(0, 360),
      depthTint: rf(0.1, 0.9),
      gradAmt: rf(0, 0.8),
      gradAngle: ri(0, 360),
    });
    syncUI();
    scheduleRender(false);
  }

  function exportPng() {
    render(false);
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `visual-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  // ----------------------------------------------------------------- init

  buildSliders();
  // Console/scripting access: studio.state.params, studio.render(), etc.
  window.studio = { state, render: () => scheduleRender(false), syncUI, applyPreset, randomize };
  $('preset').addEventListener('change', (e) => applyPreset(e.target.value));
  $('randomize').addEventListener('click', randomize);
  $('export').addEventListener('click', exportPng);
  for (const id of ['colorA', 'colorB', 'colorBg']) {
    $(id).addEventListener('input', () => scheduleRender(true));
    $(id).addEventListener('change', () => scheduleRender(false));
  }

  applyPreset($('preset').value);
})();
