# Implementation and verification

## Application

The Go/Wails v3 application is in this project. The local unsigned Apple Silicon macOS bundle is `build/bin/PDF Slide Viewer.app`; `build/bin/pdf-viewer` is the standalone executable. `README.md` contains build and presentation instructions. `sample/four-slides.pdf` is a four-page test deck.

- Separate fullscreen audience window and operator window with live and independent cue previews.
- Arrow keys browse the cue; Enter/Space takes the selected cue live and advances the cue. This supports reviewing and skipping slides without changing the audience.
- Controls work in either window. Enter in the page field applies the typed page before taking it live.
- Local PDF.js rendering, native file picker, reopen-audience and fullscreen controls.
- Generation/revision protection, bounded navigation, per-window command sequencing, and buffered rendering without blanking the unchanged live slide during cue browsing.

## Verification

Passed during this run:

- `./scripts/package-macos.sh` (TypeScript check, Vite production build, Go native build, app packaging).
- `go test -race -count=1 ./...` (main, document and presentation packages).
- `go vet ./...`.
- `npm run test:integration -- --repeat-each=3`: all 15 executions passed (five tests repeated three times).
- App `Info.plist` validation.

Browser integration uses the real sample PDF and PDF.js, with a simulated Wails transport modeling serialized backend state. Tests cover both-window synchronization, all arrow directions, backward presentation, Enter/Space, cue bounds, invalid PDF handling, unchanged-live canvas stability, delayed-Move ordering, and Enter in the cue field. Three new regression tests were observed failing before the corresponding fixes, then passing after them. An independent code review identified those fixes.

Native startup produced Wails v3.1.0 logs; an operator-window screenshot was captured during this run. Native interactive verification could not proceed: desktop input is denied in this headless task because it requires live approval. A later direct-launch process ran without a capturable on-screen window and was terminated after the smoke check. Browser transport tests do not verify real Wails RPCs, native dialogs, macOS fullscreen/Spaces, or external-monitor placement.

## Review checklist

Before acceptance, open the app normally and use the sample PDF to check native file selection, fullscreen audience placement, cue/Take behavior and keyboard controls with each native window focused. Check close/reopen audience and operator-close quitting. Repeat with a second monitor if available.

The app is unsigned and not notarized. The successful native build emitted macOS deployment-target mismatch warnings (objects built for 26.0 versus link target 11.0); compatibility with older macOS versions is not certified. No Windows/Linux build was tested.
