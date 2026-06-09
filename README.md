# generative-visuals

**Particle Surface Studio** — a zero-dependency, slider-driven canvas tool for
generating dotted particle-surface artwork: 3D parametric surfaces sampled as
a dense lattice of tiny dots, drawn in two slightly offset red/blue passes on
a dusty-rose background.

The regular dot grid produces moiré interference rings when the surface folds;
the **jitter** slider trades that moiré for spray-paint grain; the **chroma
offset** sliders produce red/blue fringing on the rims; **depth tint** zones
the colors front-to-back.

## Run

No build step. Either open `index.html` directly in a browser, or:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Controls

- **Shape** — preset (Shell / Flower / Ellipse / Blob), lobes, amplitude,
  twist, and per-axis stretch of the parametric surface.
- **View** — rotation on three axes and zoom.
- **Texture** — grid density, dot size/alpha, jitter (grain), chromatic
  offset amount/angle, depth tint.
- **Color** — front (red), back (blue), and background colors.
- **Randomize** re-seeds and rolls new shape parameters; **Export PNG**
  downloads the canvas at full resolution (1000×1250).

While dragging a slider the canvas renders at reduced density for speed; the
full-density render lands on release.
