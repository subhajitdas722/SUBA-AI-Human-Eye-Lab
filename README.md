# SUBA AI – Human Eye Anatomy Lab

An interactive 3D teaching viewer for external and internal eye anatomy.

## Status

The web viewer source and attribution are being committed here. The binary model files and Draco decoder files must be uploaded using GitHub's browser interface (instructions below), because the connected GitHub file action accepts text files rather than binary GLB data.

## Required binary assets

In this repository, use **Add file → Upload files** and upload these exact files while preserving their paths:

- `models/eye-anatomy.glb` — copy from your Ocularium integration kit. It is the 23-mesh HRA-derived internal anatomy model.
- `models/human_eye.glb` — your DEGUIDER Sketchfab exterior download.
  
The viewer uses the Draco decoder from Google's public CDN; no local Draco files are required.

## Run locally

```bash
python -m http.server 8000
```

Open http://localhost:8000. Do not open the page using `file://`.

## Enable GitHub Pages

1. Open **Settings → Pages**.
2. Under Build and deployment, choose **Deploy from a branch**.
3. Choose branch **main**, folder **/(root)**, then Save.
4. Wait for the GitHub Pages deployment to finish.

Published address:
https://subhajitdas722.github.io/SUBA-AI-Human-Eye-Lab/

## Licence and attribution

- HRA-derived anatomical model via Ocularium: upstream project identifies the asset as CC BY 4.0. See `licenses/ATTRIBUTION.txt`.
- DEGUIDER exterior Sketchfab model: source listing identifies it as CC BY. Preserve creator credit and source link.
- The Science Museum Group model is not included because its CC BY-NC licence restricts commercial use.

The internal GLB has 23 named meshes. It does not contain an individually named optic nerve mesh. A layer list is not a guarantee that every named anatomical term is an independently isolated biological tissue.
