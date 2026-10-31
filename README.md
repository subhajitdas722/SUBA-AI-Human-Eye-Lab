# SUBA AI – Human Eye Anatomy Lab

Interactive 3D educational eye viewer built with Three.js.

## Included in this repository

- `index.html`, `style.css`, `app.js`: responsive web viewer
- `licenses/`: model attribution and third-party notices
- `models/README.md`: exact locations and names for the two required binary models

## Required GLB uploads

The web viewer source is committed, but the GLB files are binary and still need to be uploaded through GitHub's browser interface.

1. Open the [models folder](https://github.com/subhajitdas722/SUBA-AI-Human-Eye-Lab/tree/main/models).
2. Select **Add file → Upload files**.
3. Upload these two files, keeping the exact filenames:
   - `eye-anatomy.glb` — from the Ocularium archive: `ocularium-main/public/models/eye-anatomy.glb`.
   - `human_eye.glb` — your downloaded DEGUIDER Sketchfab exterior model.
4. Commit the upload to the `main` branch.

The viewer loads the GLB assets from these paths:
- `./models/eye-anatomy.glb`
- `./models/human_eye.glb`

The internal HRA-derived GLB is Draco-compressed. The viewer loads the Google Draco 1.5.7 decoder from Google's CDN; no local Draco decoder files need to be uploaded. Internet access is required for Three.js modules and the decoder.

## Run locally

From the repository root:

```bash
python -m http.server 8000
```

Open http://localhost:8000. Do not open the page with `file://`.

## Publish with GitHub Pages

1. Open **Settings → Pages**.
2. Under Build and deployment, choose **Deploy from a branch**.
3. Choose branch **main**, folder **/(root)**, then Save.
4. Wait for the GitHub Pages deployment to finish.

Published address:
https://subhajitdas722.github.io/SUBA-AI-Human-Eye-Lab/

## Licence and attribution

- The HRA-derived anatomical model via Ocularium is identified by the upstream project as CC BY 4.0. See `licenses/ATTRIBUTION.txt`.
- The DEGUIDER exterior Sketchfab model is identified by the source listing as CC BY. Preserve creator credit and source link.
- The Science Museum Group scan is not included because its CC BY-NC licence restricts commercial use.
- Three.js and Draco are third-party libraries; see `licenses/THIRD_PARTY.txt`.

The internal model has 23 named meshes. It does not contain an individually named optic nerve mesh. The layer list should not be interpreted as a guarantee that every anatomical term is an isolated biological tissue.
