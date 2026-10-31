# Advanced components

From the repository root:

```sh
npm ci
npm run dev:advanced
```

Open http://127.0.0.1:5193. The gallery uses local synthetic DIL sources and data,
without OpenAI or a private backend. Updating data preserves the compiled program
and control state.

- Forms, textarea, date picker, radio and scatter plots.
- Timers, dragging, file reading, downloads and explicit local storage.
- SVG, WebGL, carousel and application-resolved images.
- Same-origin GeoJSON maps and JSON data.

Audio and video are available in the renderer: use `<audio src="/audio.wav"/>`
or `<video src="/video.webm"/>` with application-provided files. The gallery does
not include third-party media.

`npm run build:advanced` creates a static build. Keep `data.json`, `map.json`
and `sample.svg` at the site root when serving it.

Selecting another example starts a new interface. Local storage persists in the
browser until deleted using its control.

For optional browser checks, install `puppeteer-core` in the development
environment, set `CHROME_PATH` and run `npm run test:browser:advanced`.
`INTLUI_BROWSER_DRIVER` can identify an existing driver installation.
