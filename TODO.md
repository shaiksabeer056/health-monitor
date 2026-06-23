# TODO

## Goal: Add image-based disease prediction + update to disease format + predict within seconds

- [ ] Step 1: Inspect current UI entrypoints (index.html + script.js) and identify where symptom selection/prediction happens
- [ ] Step 2: Update prediction logic to use `data/diseases.json` + `data/symptoms-map.json` and return **top diseases** (not generic “risk score”)
- [ ] Step 3: Add an image upload/input (file picker) to the UI (in the main app) and read the image
- [ ] Step 4: Implement fast client-side image “symptom/disease” mapping (no heavy ML). Use filename/alt text OCR-free fallback if possible.
- [ ] Step 5: Convert detected/update symptoms into the disease prediction model and show top diseases immediately (seconds)
- [ ] Step 6: Persist prediction history in `users` with disease results
- [ ] Step 7: Add UI states/loading + validation
- [ ] Step 8: Test by running in browser: disease prediction, image prediction, and history update

