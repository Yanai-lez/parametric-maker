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

## Open `.scad` files from other apps
After installing the app, open a `.scad` file in your file manager (or any app) and choose **Share → Parametric Maker**. The code loads straight into the editor. You can also share selected text. On desktop Chrome the installed app can also be set as the default handler for `.scad` files. Android only picks up manifest changes after a while, so if the entry is missing, uninstall and re-install the app once.

## Fonts
`vendor/fonts/g/` holds 56 Google font families (Regular + Bold, 20 with Hebrew), listed in `vendor/fonts/manifest.json`. A family is only loaded when the code or a parameter value uses its name, so unused fonts cost nothing. Use `font="Heebo:style=Bold"` style names.
