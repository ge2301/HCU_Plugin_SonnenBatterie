# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the React + Vite dashboard
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime image for the HCU (ARM64)
# ---------------------------------------------------------------------------
FROM --platform=linux/arm64 ghcr.io/homematicip/alpine-node-simple:0.0.1

ARG VERSION=1.0.0

WORKDIR /app

# Install production dependencies of the plugin
COPY plugin/package*.json ./
RUN npm install --omit=dev

# Copy the plugin source
COPY plugin/src ./src

# Copy the built dashboard into the folder served by the embedded HTTP server
COPY --from=frontend /frontend/dist ./public

# Persisted configuration lives here (best effort)
RUN mkdir -p /app/data

# argv: <pluginId> <hcuHost> <authTokenFile>
ENTRYPOINT ["node", "src/index.js", "de.community.homematic.plugin.sonnen", "host.containers.internal", "/TOKEN"]

# Plugin metadata read by the HCU when installing the image
LABEL de.eq3.hmip.plugin.metadata=\
'{\
	"pluginId": "de.community.homematic.plugin.sonnen",\
	"issuer": "Community",\
	"version": "1.0.0",\
	"hcuMinVersion": "1.4.7",\
	"scope": "LOCAL",\
	"friendlyName": {\
		"en": "sonnenBatterie",\
		"de": "sonnenBatterie"\
	},\
	"description": {\
		"en": "Integrates a sonnenBatterie (production, consumption, grid and state of charge) into Homematic IP via the local REST API.",\
		"de": "Bindet eine sonnenBatterie (Erzeugung, Verbrauch, Netz und Ladezustand) über die lokale REST-API in Homematic IP ein."\
	},\
	"logsEnabled": true\
}'
