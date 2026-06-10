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
- **View** — rotation on three axes, zoom, and a mirror mode
  (Flip X / Flip Y / Kaleido) that reflects the composition.
- **Copies** — repeat the surface up to 5 times with per-copy spread,
  rotation step, scale step, and optional alternating color swap (the
  Ellipse preset uses 3 alternating copies).
- **Texture** — grid density and ratio, dot size/alpha, jitter (grain),
  chromatic offset amount/angle, depth tint, directional gradient, and a
  sparkle slider that scatters rare accent-colored dots.
- **Color** — front (red), back (blue), sparkle accent, and background.
- **Randomize** re-seeds and rolls new shape parameters; **Drift** slowly
  auto-rotates the surface while the jitter and chroma offset "breathe";
  **Export PNG** downloads the canvas at full resolution (1000×1250).

The controls are sized for touch, so it works well on an iPad.

While dragging a slider the canvas renders at reduced density for speed; the
full-density render lands on release.
