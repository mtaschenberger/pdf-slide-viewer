# PDF Slide Viewer

A native Wails v3 presentation app with an operator window and a separate audience window. PDFs and the PDF.js renderer stay local; no account or network is needed to present.

## Build and run

Install Go 1.26 or newer, Node.js 22.13+ (or a supported newer release), npm, and a C compiler and platform dependencies required by Wails v3. On macOS, install the Xcode command line tools. The first build downloads dependencies.

```sh
./scripts/build.sh
./build/bin/pdf-viewer
```

On macOS, create an unsigned application bundle at `build/bin/PDF Slide Viewer.app` with:

```sh
./scripts/package-macos.sh
open 'build/bin/PDF Slide Viewer.app'
```

The scripts rebuild the frontend and embed it in the binary. To build manually, run `cd frontend && npm ci && npm run build`, then `go build -o build/bin/pdf-viewer .` from the project root. Go may download the toolchain specified by `go.mod` automatically.

## Presenting

Open a PDF in the operator window. The audience starts with page 1; the next page is cued. Left/Up and Right/Down browse the cue without changing the audience. Enter or Space takes the cue live and advances the cue, stopping at the last page. The page field and buttons offer the same controls. Keyboard shortcuts work in either window. While editing the page field, arrow keys edit the number; Enter applies that page and takes it live. Rapid cue/take inputs are processed in order, and browsing the cue does not redraw or blank the audience's unchanged live slide.

The audience window opens fullscreen, on a non-primary display when one is available. Escape exits fullscreen. Use **Toggle fullscreen** to move the window manually and restore fullscreen; **Open audience** brings it back after closing it. Closing the operator quits the application. Canceling the open dialog leaves the presentation alone; a selected invalid or encrypted PDF is reported to the operator and the audience is blanked. The sample at `sample/four-slides.pdf` has four pages.

## Checks

```sh
cd frontend
npm ci
npm run build
npx playwright install chromium
npm run test:integration
cd ..
go test -race ./...
go vet ./...
go build ./...
```

The browser integration tests use the real bundled PDF.js and the sample PDF with a simulated Wails transport; they do not replace a native two-display check. Set `CHROME_PATH` to a Chromium-compatible executable to use an existing browser instead of Playwright's installed Chromium. The macOS bundle is local and unsigned; distribution requires the usual signing and notarization steps.
