"use strict";

const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const logger = require("./logger");

/**
 * Manages the WebSocket connection to the HCU Connect API and implements the
 * message flows relevant for a read-only sensor plugin.
 *
 * The class is intentionally passive about business logic: it delegates to the
 * callbacks provided in the constructor to obtain the current devices, readiness
 * status and configuration handling.
 *
 * Callbacks:
 *   - getReadiness()          -> "READY" | "CONFIG_REQUIRED" | "ERROR"
 *   - getDevices()            -> array of Device objects (full status)
 *   - getConfigTemplate()     -> { groups, properties }
 *   - onConfigUpdate(props)   -> Promise<{ status, message }>
 */
class HcuClient {
	constructor({ pluginId, host, authToken, callbacks }) {
		this.pluginId = pluginId;
		this.host = host;
		this.authToken = authToken;
		this.callbacks = callbacks;
		this.ws = null;
		this.connected = false;
		this.reconnectDelayMs = 2000;
		this.maxReconnectDelayMs = 30000;
		this.shouldRun = true;
	}

	connect() {
		const url = `wss://${this.host}:9001`;
		logger.info(`Connecting to HCU Connect API at ${url} (plugin ${this.pluginId})`);

		this.ws = new WebSocket(url, {
			rejectUnauthorized: false,
			headers: {
				authtoken: this.authToken,
				"plugin-id": this.pluginId,
			},
		});

		this.ws.on("open", () => {
			this.connected = true;
			this.reconnectDelayMs = 2000;
			logger.info("Connected to HCU WebSocket");
			this._sendPluginState(uuidv4());
		});

		this.ws.on("message", (data) => this._handleMessage(data));

		this.ws.on("close", (code, reason) => {
			this.connected = false;
			logger.warn(`HCU WebSocket closed (code ${code}${reason ? `, ${reason}` : ""})`);
			this._scheduleReconnect();
		});

		this.ws.on("error", (err) => {
			logger.error(`HCU WebSocket error: ${err.code || ""} ${err.message || err}`);
		});
	}

	_scheduleReconnect() {
		if (!this.shouldRun) return;
		const delay = this.reconnectDelayMs;
		this.reconnectDelayMs = Math.min(this.maxReconnectDelayMs, this.reconnectDelayMs * 2);
		logger.info(`Reconnecting to HCU in ${Math.round(delay / 1000)}s`);
		setTimeout(() => this.connect(), delay);
	}

	stop() {
		this.shouldRun = false;
		if (this.ws) this.ws.close();
	}

	_send(message) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			logger.debug(`Skipped sending ${message.type}: socket not open`);
			return false;
		}
		this.ws.send(JSON.stringify(message));
		logger.debug(`Sent ${message.type}`);
		return true;
	}

	_envelope(id, type, body) {
		return { id: id || uuidv4(), pluginId: this.pluginId, type, body };
	}

	_sendPluginState(id) {
		const readiness = this.callbacks.getReadiness();
		this._send(this._envelope(id, "PLUGIN_STATE_RESPONSE", { pluginReadinessStatus: readiness }));
		logger.info(`Reported plugin readiness: ${readiness}`);
	}

	_sendDiscover(id) {
		const devices = this.callbacks.getDevices();
		this._send(this._envelope(id, "DISCOVER_RESPONSE", { success: true, devices }));
		logger.info(`Answered DISCOVER_REQUEST with ${devices.length} device(s)`);
	}

	_sendStatusResponse(id, requestedIds) {
		let devices = this.callbacks.getDevices();
		if (Array.isArray(requestedIds) && requestedIds.length > 0) {
			const set = new Set(requestedIds);
			devices = devices.filter((d) => set.has(d.deviceId));
		}
		this._send(this._envelope(id, "STATUS_RESPONSE", { success: true, devices }));
		logger.info(`Answered STATUS_REQUEST with ${devices.length} device(s)`);
	}

	_sendConfigTemplate(id) {
		const body = this.callbacks.getConfigTemplate();
		this._send(this._envelope(id, "CONFIG_TEMPLATE_RESPONSE", body));
		logger.info("Answered CONFIG_TEMPLATE_REQUEST");
	}

	async _handleConfigUpdate(id, body) {
		try {
			const result = await this.callbacks.onConfigUpdate(body ? body.properties : {});
			this._send(
				this._envelope(id, "CONFIG_UPDATE_RESPONSE", {
					status: result.status || "APPLIED",
					message: result.message || "",
				})
			);
			logger.info(`Answered CONFIG_UPDATE_REQUEST: ${result.status}`);
			// Reflect any readiness change immediately.
			this._sendPluginState(uuidv4());
		} catch (err) {
			logger.error(`Config update failed: ${err.message}`);
			this._send(
				this._envelope(id, "CONFIG_UPDATE_RESPONSE", {
					status: "FAILED",
					message: err.message,
				})
			);
		}
	}

	_handleControlRequest(id, body) {
		// This plugin exposes read-only sensors; controlling is not supported.
		this._send(
			this._envelope(id, "CONTROL_RESPONSE", {
				deviceId: body ? body.deviceId : undefined,
				success: false,
				error: { code: "FEATURE_NOT_SUPPORTED", message: "sonnen plugin devices are read-only" },
			})
		);
		logger.warn("Received CONTROL_REQUEST for a read-only device; responded not supported");
	}

	_handleMessage(data) {
		let message;
		try {
			message = JSON.parse(data);
		} catch (err) {
			logger.error(`Failed to parse incoming message: ${err.message}`);
			return;
		}
		logger.debug(`Received ${message.type}`);

		switch (message.type) {
			case "PLUGIN_STATE_REQUEST":
				this._sendPluginState(message.id);
				break;
			case "DISCOVER_REQUEST":
				this._sendDiscover(message.id);
				break;
			case "STATUS_REQUEST":
				this._sendStatusResponse(message.id, message.body ? message.body.deviceIds : null);
				break;
			case "CONFIG_TEMPLATE_REQUEST":
				this._sendConfigTemplate(message.id);
				break;
			case "CONFIG_UPDATE_REQUEST":
				this._handleConfigUpdate(message.id, message.body);
				break;
			case "CONTROL_REQUEST":
				this._handleControlRequest(message.id, message.body);
				break;
			case "ERROR_RESPONSE":
				logger.warn(`HCU reported an error: ${JSON.stringify(message.body)}`);
				break;
			default:
				logger.debug(`Ignoring unhandled message type: ${message.type}`);
		}
	}

	/**
	 * Pushes a partial status update for the given devices.
	 * @param {Array<{deviceId: string, features: Array}>} deviceUpdates
	 */
	sendStatusEvents(deviceUpdates) {
		for (const update of deviceUpdates) {
			this._send(this._envelope(uuidv4(), "STATUS_EVENT", update));
		}
		if (deviceUpdates.length > 0) {
			logger.debug(`Pushed status events for ${deviceUpdates.length} device(s)`);
		}
	}

	/** Sends the current plugin readiness proactively (e.g. after a poll failure). */
	pushReadiness() {
		if (this.connected) this._sendPluginState(uuidv4());
	}
}

module.exports = HcuClient;
