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
	const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET || env.UPLOAD_PRESET || "";
	const apiKey = env.API_KEY || env.CLOUDINARY_API_KEY || "";
	const apiSecret = env.API_SECRET || env.CLOUDINARY_API_SECRET || "";

	if (!cloudName) {
		throw new Error("Missing CLOUD_NAME/CLOUDINARY_CLOUD_NAME in .env");
	}

	const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

	// Preferred mode for client-side contexts: unsigned preset upload.
	if (uploadPreset) {
		const unsignedForm = new FormData();
		unsignedForm.append("file", sourceUrl);
		unsignedForm.append("upload_preset", uploadPreset);

		const unsignedResponse = await fetch(endpoint, {
			method: "POST",
			body: unsignedForm
		});
		const unsignedData = await unsignedResponse.json().catch(() => ({}));
		if (unsignedResponse.ok && unsignedData.secure_url) {
			return unsignedData.secure_url;
		}
	}

	// Signed upload fallback.
	if (!apiKey || !apiSecret) {
		throw new Error("Cloudinary upload preset missing and signed API credentials unavailable");
	}

	const timestamp = Math.floor(Date.now() / 1000);
	const folder = "instagram-extractor";
	const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
	const signature = await sha1Hex(toSign);

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

function buildCloudinaryFetchUrl(sourceUrl) {
	if (!sourceUrl) return "";
	if (/res\.cloudinary\.com/i.test(sourceUrl)) return sourceUrl;

	const cloudName = "dq0ut0v89";
	return `https://res.cloudinary.com/${cloudName}/image/fetch/${encodeURIComponent(sourceUrl)}`;
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
			const warnings = [];
			if (payload.media_type === "image" && payload.media_url) {
				try {
					const uploadedUrl = await uploadImageToCloudinary(payload.media_url);
					payload.media_url = uploadedUrl;
				} catch (uploadError) {
					const fetchUrl = buildCloudinaryFetchUrl(payload.media_url);
					if (fetchUrl) {
						payload.media_url = fetchUrl;
						warnings.push(`Cloudinary upload failed; used fetch URL fallback. Reason: ${uploadError?.message || String(uploadError)}`);
					} else {
						warnings.push(`Cloudinary upload skipped: ${uploadError?.message || String(uploadError)}`);
					}
				}
			}

			const sanitizedPayload = sanitizeDoubleQuotes(payload);
			const payloadList = [sanitizedPayload];
			const primaryUrl = message.url || WEBHOOK_URL;
			let usedUrl = primaryUrl;
			let response = await fetch(primaryUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(payloadList)
			});

			if (!response.ok && primaryUrl !== WEBHOOK_URL) {
				warnings.push(`Primary webhook failed with ${response.status}; retried default webhook URL.`);
				usedUrl = WEBHOOK_URL;
				response = await fetch(WEBHOOK_URL, {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(payloadList)
				});
			}

			const responseText = await response.text().catch(() => "");
			sendResponse({
				ok: response.ok,
				status: response.status,
				url: usedUrl,
				warnings,
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
