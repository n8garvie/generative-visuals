# generative-visuals

**Particle Surface Studio** — a zero-dependency, slider-driven canvas tool for
generating dotted particle-surface artwork: 3D parametric surfaces sampled as
a dense lattice of tiny dots, drawn in two slightly offset red/blue passes on
a dusty-rose background.

The regular dot grid produces moiré interference rings when the surface folds;
the **jitter** slider trades that moiré for spray-paint grain; the **chroma
offset** sliders produce red/blue fringing on the rims; **depth tint** zones
the colors front-to-back. Every dot stays pure red or pure blue — mid-tones
are stochastically dithered so mixed regions read as vivid optical grey-blue
rather than blended purple. **Grid ratio** thins one lattice direction into
visible dotted rows (a woven look), and **gradient**/**grad angle** sweep the
color balance directionally across the canvas.

## Run

No build step. Either open `index.html` directly in a browser, or:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Controls

- **Shape** — preset (Shell / Flower / Ellipse / Mesh / Blob), lobes,
  amplitude, twist, and per-axis stretch of the parametric surface.
  **Smoothing** rounds the pointy lobe tips and keeps the surface from
  pinching through the centre, trading sharp cusps for flowing curves.
- **View** — rotation on three axes, zoom, and a mirror mode
  (Flip X / Flip Y / Kaleido) that reflects the composition.
- **Animation** — a lava-lamp style loop plays by default. **Loop (sec)**
  sets the loop length (default 5 s), **Morph** sends a wave traveling
  around the surface so the lobes flow like rising lava, **Sway** rocks the
  view, and **Breathe** pulses amplitude, zoom, jitter, and chroma offset.
  Every modulation is periodic over one loop, so it repeats seamlessly.
- **Copies** — repeat the surface up to 5 times with per-copy spread,
  rotation step, scale step, and optional alternating color swap (the
  Ellipse preset uses 3 alternating copies).
- **Texture** — grid density and ratio, dot size/alpha, jitter (grain),
  chromatic offset amount/angle, depth tint, directional gradient, and a
  sparkle slider that scatters rare accent-colored dots.
- **Color** — front (red), back (blue), sparkle accent, and background.
- **Play / Pause** toggles the loop (pausing freezes the current pose);
  **Randomize** re-seeds and rolls new shape parameters.

## Export

- **Export PNG** — downloads the current frame at full resolution
  (1000×1250), including the current animation pose.
- **Export GIF** — renders every frame of one loop offline at full dot
  density (half resolution, 500×625, 20 fps) and encodes it with the
  built-in zero-dependency GIF89a encoder (`gif.js`). Deterministic and
  perfectly seamless; takes a little while, progress is shown in the panel.
- **Export Video** — records exactly one loop of the live animation in real
  time with `MediaRecorder` (WebM where supported, MP4 otherwise) at full
  canvas resolution and the live preview's dot density.

The controls are sized for touch, so it works well on an iPad. The toggle in
the bottom-right corner of the canvas maximizes it over the whole viewport
(handy on phones); tap again to bring the panel back.

While dragging a slider (and during animation playback) the canvas renders
at reduced density for speed; the full-density render lands on release or
pause.
