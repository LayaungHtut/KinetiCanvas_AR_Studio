# KinetiCanvas AR Studio

Draw interactive **harp strings**, **contour lines** and **radar rings** over a live camera feed,
an uploaded video or a procedural demo stream — then play them with your mouse, your finger, motion
in the video, or your bare hands (MediaPipe hand tracking).

Built with SvelteKit, Svelte 5 runes, TypeScript and Tailwind CSS 4. Ported from the original
single-file prototype `kinetic_ar_video_canvas_harp_strings_contours_radar.html` (kept in the repo
root for reference).

## Features

- **Shape tools**: harp string, harp fan/array, freehand contour, radar ring, edit & move, cut.
- **Web Audio synth**: plucked harp notes in four tuning scales, sonar pings, contour swells.
- **Video sources**: live camera (mirrored), uploaded video with a transport bar, or a procedural
  demo motion stream.
- **Optical motion triggers**: movement in the video plucks strings, ripples contours and paints
  radar target locks. Optional luma contours and motion sparkles overlays.
- **Hand gestures**: pinch thumb + index to draw, strum strings with any part of the hand skeleton,
  pinch thumb + pinky to cycle tools, or hover your index finger over the AR pads at the top.
- **Export**: PNG snapshot and WebM/MP4 recording that includes the synth audio.
- **Shortcuts**: right-click deletes a shape; `Delete`/`Backspace` deletes the selected (or last)
  shape.

Camera access needs a secure context (`localhost` or HTTPS). Hand tracking loads MediaPipe Hands
from the jsDelivr CDN the first time it is switched on.

## Project structure

```
src/
├── app.html                     # HTML shell (fonts, meta)
├── routes/
│   ├── +layout.svelte           # global CSS + favicon
│   ├── +page.svelte             # the studio page
│   └── layout.css               # Tailwind setup, theme fonts, glass-panel style
└── lib/
    ├── index.ts                 # public exports (#lib)
    ├── components/              # Svelte UI
    │   ├── KinetiCanvasStudio.svelte   # root: creates the Studio and shares it via context
    │   ├── StudioHeader.svelte         # sources, hand-gesture toggle, audio, export
    │   ├── ToolSidebar.svelte          # tools, colors, parameters, toggles, presets
    │   ├── CanvasStage.svelte          # <canvas> + hidden <video> + overlays
    │   ├── HudBar.svelte, SelectedInspector.svelte, VideoTransport.svelte, ToastMessage.svelte
    │   └── Icon.svelte, icons.ts, RangeControl.svelte, ToggleRow.svelte
    └── kineticanvas/            # framework-agnostic engine
        ├── studio.svelte.ts     # Studio class: reactive UI state + render loop + actions
        ├── context.ts           # createContext for the Studio
        ├── types.ts, constants.ts, geometry.ts
        ├── audio/sound-engine.ts
        ├── engine/              # shapes (factory, presets, hit-testing), motion analyzer, demo video
        ├── hands/               # MediaPipe loader + gesture controller
        └── render/              # canvas drawing: shapes, overlays, hand skeleton & AR pads
```

Per-frame simulation data (shapes, particles, hand landmarks) is kept as plain objects and drawn
straight to the canvas; only UI-facing values are Svelte `$state`, so the 60 fps loop doesn't pay
for reactivity.

## Developing

```sh
npm install
npm run dev          # start the dev server
npm run check        # svelte-check / TypeScript
npm run lint         # prettier + eslint
npm run test         # vitest: unit tests (node) + component tests (Playwright Chromium)
npm run build        # production build
```

Component tests run in a real browser. Install it once with `npx playwright install chromium`.

> To deploy, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your
> target environment (the project uses `adapter-auto`).
