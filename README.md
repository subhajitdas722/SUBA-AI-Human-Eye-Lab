# SUBA AI – Human Eye Anatomy Lab

Interactive 3D teaching viewer with two views:

- **Anatomy:** detailed cross-section model by Erik Ao, containing 54 GLB mesh objects arranged in anatomical groups.
- **Exterior:** DEGUIDER's separate exterior-eye model.

## Required model files

Inside the repository's `models/` folder:

- `eye-cross-section.glb.gz` — optimised gzip-compressed version of the 54-mesh cross-section GLB by Erik Ao. The viewer decompresses it in the browser using the native `DecompressionStream` API.
- `human_eye.glb` — DEGUIDER exterior-eye model.

The older `eye-anatomy.glb` HRA model is retained in the repository as a backup but is no longer used by the Anatomy view.

## Upload the new cross-section model

Download the optimised file supplied in this chat, then:

1. Open the [models folder](https://github.com/subhajitdas722/SUBA-AI-Human-Eye-Lab/tree/main/models).
2. Select **Add file → Upload files**.
3. Upload the file and rename it exactly to `eye-cross-section.glb.gz`.
4. Commit the upload to branch `main`.

The optimised upload is approximately 21 MB. Its embedded GLB retains 54 mesh objects, original material references, embedded texture imagery (resized to 1024 px JPEG), and the Sketchfab attribution metadata. Vertex normals are reconstructed by the viewer at load time to reduce file size.

The web viewer uses Three.js from jsDelivr. It also uses the browser's native gzip decompression support; use a current Chrome or Edge browser.

## Run locally

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

## Attribution and licences

- Cross-section model: **Erik Ao**, “Cross Section of Eye - Anatomy”, CC BY 4.0. See `licenses/ATTRIBUTION.txt`.
- Exterior model: **DEGUIDER**, “Human Eye”, CC BY according to the Sketchfab listing. See attribution file.
- The older HRA-derived model remains in this repository as a backup and is identified upstream as CC BY 4.0.
- Three.js is a third-party runtime; see its source project.

The new cross-section model contains 54 mesh objects, including grouped pieces for structures such as sclera, choroid and retina. The UI groups related meshes where appropriate. Do not assume every mesh corresponds to a unique biological tissue.


## On-model labels

Both 3D views now include live-positioned labels with leader lines:

- Cross-section labels: cornea, iris, crystalline lens, suspensory ligaments, sclera, choroid, muscle groups, retina, artery and vein.
- Exterior labels: eye body and iris, matching the two independently named meshes in the exterior GLB.

Use the **Hide labels / Show labels** control below the 3D viewer to toggle annotations. Labels follow the model as it rotates and zooms. The exterior asset does not provide separate cornea or sclera meshes, so its label identifies the main mesh as the eye body rather than claiming more detail than the file contains.
