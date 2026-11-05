#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
(cd frontend && npm ci && npm run build)
mkdir -p build/bin
go build -o build/bin/pdf-viewer .
