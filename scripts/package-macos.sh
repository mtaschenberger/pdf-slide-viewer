#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
[ "$(uname -s)" = Darwin ] || { echo 'macOS is required' >&2; exit 1; }
./scripts/build.sh
app='build/bin/PDF Slide Viewer.app'
mkdir -p "$app/Contents/MacOS"
cp build/bin/pdf-viewer "$app/Contents/MacOS/pdf-viewer"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>pdf-viewer</string><key>CFBundleIdentifier</key><string>local.pdfslideviewer.app</string><key>CFBundleName</key><string>PDF Slide Viewer</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>
PLIST
printf 'Created %s\n' "$app"
