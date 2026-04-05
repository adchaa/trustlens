const WEBHOOK_URL = "https://scoldable-liza-semipervious.ngrok-free.dev/webhook/48250631-d225-4a3c-a10b-6fdb2edf046e";
let envCache = null;

function parseEnv(text) {
	const result = {};
	text.split(/\r?\n/).forEach((line) => {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) return;
		const idx = trimmed.indexOf("=");
		if (idx <= 0) return;
		const key = trimmed.slice(0, idx).trim();
		const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
		result[key] = value;
	});
	return result;
}

async function loadEnv() {
	if (envCache) return envCache;
	try {
		const envUrl = chrome.runtime.getURL(".env");
		const response = await fetch(envUrl);
		if (!response.ok) {
			envCache = {};
			return envCache;
		}
		const text = await response.text();
		envCache = parseEnv(text);
		return envCache;
	} catch {
		envCache = {};
		return envCache;
	}
}

async function sha1Hex(input) {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-1", data);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function uploadImageToCloudinary(sourceUrl) {
	if (!sourceUrl) return "";
	if (/res\.cloudinary\.com/i.test(sourceUrl)) return sourceUrl;

	const env = await loadEnv();
	const cloudName = env.CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME || "";
	const apiKey = env.API_KEY || env.CLOUDINARY_API_KEY || "";
	const apiSecret = env.API_SECRET || env.CLOUDINARY_API_SECRET || "";
	if (!cloudName || !apiKey || !apiSecret) {
		throw new Error("Missing Cloudinary credentials in .env for upload");
	}

	const timestamp = Math.floor(Date.now() / 1000);
	const folder = "instagram-extractor";
	const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
	const signature = await sha1Hex(toSign);

	const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
	const formData = new FormData();
	formData.append("file", sourceUrl);
	formData.append("api_key", apiKey);
	formData.append("timestamp", String(timestamp));
	formData.append("folder", folder);
	formData.append("signature", signature);

	const response = await fetch(endpoint, {
		method: "POST",
		body: formData
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok || !data.secure_url) {
		throw new Error(data.error?.message || `Cloudinary upload failed (${response.status})`);
	}

	return data.secure_url;
}

function sanitizeDoubleQuotes(value) {
	if (typeof value === "string") {
		return value.replace(/"/g, "'");
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeDoubleQuotes(item));
	}

	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, innerValue]) => [key, sanitizeDoubleQuotes(innerValue)])
		);
	}

	return value;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type !== "SEND_POST_PAYLOAD") return undefined;

	(async () => {
		try {
			const payload = { ...(message.payload || {}) };
			if (payload.media_type === "image" && payload.media_url) {
				const uploadedUrl = await uploadImageToCloudinary(payload.media_url);
				payload.media_url = uploadedUrl;
			}

			const sanitizedPayload = sanitizeDoubleQuotes(payload);
			const payloadList = [sanitizedPayload];

			const response = await fetch(message.url || WEBHOOK_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(payloadList)
			});

			const responseText = await response.text().catch(() => "");
			sendResponse({
				ok: response.ok,
				status: response.status,
				body: responseText,
				payload: payloadList
			});
		} catch (error) {
			sendResponse({
				ok: false,
				error: error?.message || String(error)
			});
		}
	})();

	return true;
});
