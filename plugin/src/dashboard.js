"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

/**
 * Small embedded HTTP server that serves:
 *   - the built React dashboard (static files from ./public), and
 *   - a JSON state API consumed by that dashboard.
 *
 * It has no external dependencies. When running the plugin locally with Docker
 * you can expose this port (e.g. -p 8090:8090) to view live data. On the HCU the
 * dashboard is optional; the core Connect API integration works without it.
 */

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".png": "image/png",
	".woff2": "font/woff2",
};

const PUBLIC_DIR = process.env.SONNEN_PUBLIC_DIR || path.join(__dirname, "..", "public");

function sendJson(res, status, payload) {
	const body = JSON.stringify(payload);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "no-store",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
	});
	res.end(body);
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => {
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
			} catch (err) {
				reject(err);
			}
		});
		req.on("error", reject);
	});
}

function serveStatic(res, urlPath) {
	// Normalise and prevent path traversal.
	const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
	let filePath = path.join(PUBLIC_DIR, safePath === "/" ? "index.html" : safePath);

	if (!filePath.startsWith(PUBLIC_DIR)) {
		res.writeHead(403).end("Forbidden");
		return;
	}

	fs.stat(filePath, (err, stat) => {
		if (err || !stat.isFile()) {
			// SPA fallback to index.html
			const indexPath = path.join(PUBLIC_DIR, "index.html");
			fs.readFile(indexPath, (indexErr, content) => {
				if (indexErr) {
					res.writeHead(404, { "Content-Type": "text/plain" });
					res.end("Dashboard not built. Core plugin is running.");
					return;
				}
				res.writeHead(200, { "Content-Type": MIME[".html"] });
				res.end(content);
			});
			return;
		}
		const ext = path.extname(filePath).toLowerCase();
		fs.readFile(filePath, (readErr, content) => {
			if (readErr) {
				res.writeHead(500).end("Internal Server Error");
				return;
			}
			res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
			res.end(content);
		});
	});
}

/**
 * @param {number} opts.port
 * @param {() => object} opts.getState - returns the current dashboard state object
 * @param {(body: object) => Promise<object>} opts.onConfigSave - called when dashboard submits config
 */
function startDashboard({ port, getState, onConfigSave }) {
	const server = http.createServer((req, res) => {
		const method = req.method;
		const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

		if (method === "OPTIONS") {
			res.writeHead(204, {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type",
			});
			res.end();
			return;
		}

		if (urlPath === "/api/state") {
			sendJson(res, 200, getState());
			return;
		}
		if (urlPath === "/api/health") {
			sendJson(res, 200, { status: "ok" });
			return;
		}
		if (urlPath === "/api/config" && method === "POST") {
			readBody(req)
				.then((body) => {
					if (!onConfigSave) {
						res.writeHead(501, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "config save not configured" }));
						return;
					}
					return onConfigSave(body);
				})
				.then((result) => {
					sendJson(res, 200, result || { status: "ok" });
				})
				.catch((err) => {
					sendJson(res, 400, { error: err.message || "Invalid request body" });
				});
			return;
		}
		serveStatic(res, urlPath);
	});

	server.on("error", (err) => {
		logger.warn(`Dashboard server error on port ${port}: ${err.message}`);
	});

	server.listen(port, () => {
		logger.info(`Dashboard available on http://0.0.0.0:${port} (serving ${PUBLIC_DIR})`);
	});

	return server;
}

module.exports = { startDashboard };
