#!/usr/bin/env bash
# Builds the sonnenBatterie HCU plugin and exports it as an installable .tar.gz
# Requires Docker with buildx (for the linux/arm64 target).
#
# Usage:
#   ./build.sh            # builds version 1.0.0
#   ./build.sh 1.1.0      # builds a specific version
set -euo pipefail

VERSION="${1:-1.0.0}"
PLUGIN_ID="de.community.homematic.plugin.sonnen"
IMAGE="sonnen-hcu-plugin:${VERSION}"
OUTPUT="${PLUGIN_ID}-${VERSION}.tar.gz"

echo "Building ${IMAGE} for linux/arm64 ..."
docker build --platform=linux/arm64 --build-arg VERSION="${VERSION}" -t "${IMAGE}" .

echo "Exporting to ${OUTPUT} ..."
docker save "${IMAGE}" | gzip > "${OUTPUT}"

echo "Done. Upload '${OUTPUT}' in the HCU web interface (developer mode)."
