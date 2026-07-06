# Builds the sonnenBatterie HCU plugin and exports it as an installable .tar.gz
# Requires Docker with buildx (for the linux/arm64 target).
#
# Usage:
#   ./build.ps1                 # builds version 1.0.0
#   ./build.ps1 -Version 1.1.0  # builds a specific version

param(
	[string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$PluginId = "de.community.homematic.plugin.sonnen"
$Image = "sonnen-hcu-plugin:$Version"
$Output = "$PluginId-$Version.tar.gz"

Write-Host "Building $Image for linux/arm64 ..." -ForegroundColor Cyan
docker build --platform=linux/arm64 --build-arg VERSION=$Version -t $Image .

Write-Host "Exporting to $Output ..." -ForegroundColor Cyan
docker save $Image | gzip > $Output

Write-Host "Done. Upload '$Output' in the HCU web interface (developer mode)." -ForegroundColor Green
