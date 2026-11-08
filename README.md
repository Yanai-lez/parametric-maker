# Parametric Maker

Mobile-friendly parametric model maker. Paste or upload OpenSCAD code, get a parameter panel built from the Customizer comments, a live 3D preview, and 3MF export. Everything runs in the browser.

`vendor/` holds OpenSCAD WASM and three.js so the site does not depend on a CDN.

## Supported (same as MakerWorld Parametric Model Maker)
- Customizer comments: ranges, dropdowns, checkboxes, text, groups, `/* [Hidden] */`
- `// color` color picker, `// font` font picker
- `mw_plate_N()` plates, `mw_assembly_view()` (preview only, not exported)
- File uploads via `default.svg` / `default.png` / `default.stl`
- Bundled library: BOSL2 (`include <BOSL2/std.scad>;`)
- `text()` with Liberation Sans
- Save the code as `.scad`, export 3MF

## Install
Open the site in Chrome (Android) or Safari (iOS) and use the browser menu: "Install app" / "Add to Home Screen". After the first visit it also works offline.
