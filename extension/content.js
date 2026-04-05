// content.js - Instagram per-post extractor UI

(function initInstagramExtractor() {
	const STYLE_ID = "ig-post-viewer-style";
	const BTN_CLASS = "ig-post-viewer-btn";
	const PANEL_CLASS = "ig-post-viewer-panel";
	const CONTROLS_CLASS = "ig-post-viewer-controls";
	const WEBHOOK_URL = "https://scoldable-liza-semipervious.ngrok-free.dev/webhook-test/48250631-d225-4a3c-a10b-6fdb2edf046e";

	function injectStyles() {
		if (document.getElementById(STYLE_ID)) return;

		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			article[data-ig-post-viewer-button-added="1"] {
				position: relative;
			}

			.${CONTROLS_CLASS} {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				margin-left: 8px;
				vertical-align: middle;
			}

			.${CONTROLS_CLASS} .ig-post-mini-tag {
				font-size: 10px;
				font-weight: 700;
				color: #8a0000;
				background: #fff2f2;
				border: 1px solid #ffc9c9;
				border-radius: 999px;
				padding: 2px 7px;
			}

			.${BTN_CLASS} {
				border: 1px solid #d90000;
				color: #d90000;
				background: #fff;
				border-radius: 999px;
				font-size: 11px;
				font-weight: 700;
				padding: 4px 9px;
				cursor: pointer;
			}

			.${BTN_CLASS}:hover {
				background: #ffeaea;
			}

			.${PANEL_CLASS} {
				position: absolute;
				top: 8px;
				right: -290px;
				width: 260px;
				height: 260px;
				overflow: auto;
				background: #fff;
				border: 2px solid #d90000;
				border-radius: 10px;
				padding: 10px;
				box-sizing: border-box;
				z-index: 20;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
				font-size: 12px;
				line-height: 1.4;
				white-space: pre-wrap;
				word-break: break-word;
			}

			.${PANEL_CLASS} .ig-post-viewer-panel-title {
				color: #d90000;
				font-size: 12px;
				font-weight: 700;
				margin-bottom: 6px;
			}

			.${PANEL_CLASS} .ig-post-viewer-panel-body {
				background: #fff7f7;
				border: 1px solid #ffd3d3;
				border-radius: 8px;
				padding: 8px;
			}

			@media (max-width: 1300px) {
				.${PANEL_CLASS} {
					right: 8px;
					top: 52px;
					width: 230px;
					height: 220px;
				}
			}
		`;
		document.head.appendChild(style);
	}

	async function fetchPostMeta(postUrl) {
		if (!postUrl) return {};

		try {
			const response = await fetch(postUrl, { credentials: "include" });
			if (!response.ok) return {};

			const html = await response.text();
			const doc = new DOMParser().parseFromString(html, "text/html");
			const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
			const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
			const publishedTime = doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content") || doc.querySelector('time')?.getAttribute('datetime') || doc.querySelector('time')?.textContent?.trim() || "";
			const pageTitle = doc.querySelector("title")?.textContent?.trim() || "";

			return {
				ogTitle: ogTitle.trim(),
				ogDescription: ogDescription.trim(),
				pageTitle,
				publishedTime
			};
		} catch {
			return {};
		}
	}

	async function fetchProfilePrivate(profileUrl) {
		if (!profileUrl) return false;
		try {
			const response = await fetch(profileUrl, { credentials: "include" });
			if (!response.ok) return false;
			const html = await response.text();
			const doc = new DOMParser().parseFromString(html, "text/html");
			const bodyText = (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
			if (/this account is private/i.test(bodyText)) return true;
			const metaDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || doc.querySelector('meta[name="description"]')?.getAttribute('content') || "";
			if (/this account is private/i.test(metaDesc)) return true;
			return false;
		} catch {
			return false;
		}
	}

	function parseDescriptionFromMeta(ogDescription, username) {
		const normalized = (ogDescription || "").replace(/\s+/g, " ").trim();
		if (!normalized) return "";

		const quoteMatch = normalized.match(/"([\s\S]+)"\s*$/);
		if (quoteMatch?.[1]) return quoteMatch[1].trim();

		let text = normalized;
		text = text.replace(/^\d+[,.\d]*\s+likes?,\s*\d+[,.\d]*\s+comments?\s*-\s*/i, "");
		if (username) {
			const prefix = new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s+on\s+Instagram:\s*`, "i");
			text = text.replace(prefix, "");
		}

		return text.trim();
	}

	function sanitizePageTitle(rawTitle, username) {
		let text = (rawTitle || "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "").replace(/\s+/g, " ").trim();
		if (!text) return "";

		text = text.replace(/\s*[|-]\s*Instagram\s*$/i, "").trim();

		// Keep only the profile/title part, drop the post caption after "on Instagram".
		text = text.replace(/\s*on\s+Instagram\b[\s:："'“”«»].*$/i, "").trim();
		text = text.replace(/\s*on\s+Instagram\s*$/i, "").trim();

		const onInstagramMatch = text.match(/^(.+?\bon\s+Instagram)\s*:/i);
		if (onInstagramMatch?.[1]) {
			text = onInstagramMatch[1].trim();
		}

		if (!text && username) {
			text = username;
		}

		return text;
	}

	async function generatePostId(description, pageTitle, postDate) {
		const input = `${description || ""}::${pageTitle || ""}::${postDate || ""}`;
		try {
			const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
			const hashHex = Array.from(new Uint8Array(buffer))
				.map((byte) => byte.toString(16).padStart(2, "0"))
				.join("");
			return hashHex.slice(0, 24);
		} catch {
			let fallback = 0;
			for (let i = 0; i < input.length; i += 1) {
				fallback = (fallback << 5) - fallback + input.charCodeAt(i);
				fallback |= 0;
			}
			return `fallback_${Math.abs(fallback)}`;
		}
	}

	function toCloudinaryImageUrl(sourceUrl) {
		const url = (sourceUrl || "").trim();
		if (!url) return "";
		if (/res\.cloudinary\.com/i.test(url)) return url;

		const cloudName = "dq0ut0v89";
		return `https://res.cloudinary.com/${cloudName}/image/fetch/${encodeURIComponent(url)}`;
	}

	async function extractPostData(article) {
		let caption = "";
		const username = article.querySelector("header a")?.innerText?.trim() || "";
		let sourceTitle = username || "Unknown page";
		const permalink = article.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]')?.href || "";

		const cleanText = (value) => (value || "").replace(/\s+/g, " ").trim();
		const uiNoiseRegex = /^(view all \d+ comments|see translation|liked by|add a comment|follow|message|reply|more|likes?|comments?)$/i;
		const isUiNoise = (text) => {
			if (!text) return true;
			if (uiNoiseRegex.test(text)) return true;
			if (/^\d+[smhdw]$/i.test(text)) return true;
			if (/^\d+[,.\d]*\s+(likes?|comments?)$/i.test(text)) return true;
			if (text.length < 8) return true;
			return false;
		};

		const captionSelectors = [
			"h1",
			"h2",
			"div[data-testid='post-comment-root'] span",
			"ul li span[dir='auto']",
			"ul li h1",
			"ul li h2",
			"ul ul span",
			"span._ap3a",
			"span[dir='auto']"
		];

		for (const selector of captionSelectors) {
			const node = article.querySelector(selector);
			const text = cleanText(node?.innerText);
			if (text && !isUiNoise(text) && text !== username) {
				caption = text;
				break;
			}
		}

		if (!caption) {
			const scored = [];
			const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
			let currentNode = walker.nextNode();
			while (currentNode) {
				const parent = currentNode.parentElement;
				const tag = parent?.tagName || "";
				const text = cleanText(currentNode.textContent);
				if (parent && tag !== "SCRIPT" && tag !== "STYLE" && tag !== "BUTTON") {
					if (!isUiNoise(text) && text !== username) {
						let score = Math.min(text.length, 260);
						if (/[#@]/.test(text)) score += 60;
						if (/[.!?]/.test(text)) score += 25;
						if ((text.match(/\s/g) || []).length >= 3) score += 25;
						if (/\b(like|comment|share|follow|message)\b/i.test(text)) score -= 80;
						scored.push({ text, score });
					}
				}
				currentNode = walker.nextNode();
			}

			const unique = [];
			const seen = new Set();
			scored.forEach((item) => {
				if (!seen.has(item.text)) {
					seen.add(item.text);
					unique.push(item);
				}
			});

			unique.sort((a, b) => b.score - a.score);
			caption = unique[0]?.text || "";
		}

		let imageUrl = "";
		let videoUrl = "";
		let isVideo = false;
		const altTexts = [];

		article.querySelectorAll("video").forEach((video) => {
			const src = video.currentSrc || video.src || video.querySelector("source")?.src || "";
			if (!videoUrl && src) {
				videoUrl = src;
				isVideo = true;
			}
		});

		let maxArea = 0;
		article.querySelectorAll("img").forEach((img) => {
			const src = img.currentSrc || img.src || "";
			const alt = img.alt?.trim() || "";
			if (alt) altTexts.push(alt);
			const w = img.naturalWidth || img.width || 0;
			const h = img.naturalHeight || img.height || 0;
			const area = w * h;
			if (src && area > maxArea) {
				maxArea = area;
				imageUrl = src;
				if (!caption && alt && alt.length > 8 && !uiNoiseRegex.test(alt)) {
					caption = alt;
				}
			}
		});

		// Try to read post date from the article's time element first
		let postDate = article.querySelector('time')?.getAttribute('datetime') || article.querySelector('time')?.textContent?.trim() || "";

		if (!caption) {
			const og = document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
			const cleanedOg = cleanText(og);
			if (cleanedOg) {
				const split = cleanedOg.split(":");
				caption = cleanText(split.length > 1 ? split.slice(1).join(":") : cleanedOg);
			}
		}

		const remoteMeta = await fetchPostMeta(permalink);

		// If we didn't get a date from the article, use the remote meta
		if (!postDate && remoteMeta.publishedTime) postDate = remoteMeta.publishedTime;

		// Determine if profile is private by fetching profile page
		const profileHref = article.querySelector("header a")?.href || article.querySelector("a[role='link']")?.href || "";
		const isPrivate = profileHref ? await fetchProfilePrivate(profileHref) : false;
		if (remoteMeta.ogTitle) {
			sourceTitle = sanitizePageTitle(remoteMeta.ogTitle, username) || sourceTitle;
		} else if (remoteMeta.pageTitle) {
			sourceTitle = sanitizePageTitle(remoteMeta.pageTitle, username) || sourceTitle;
		}

		if (remoteMeta.ogDescription) {
			const metaDescription = parseDescriptionFromMeta(remoteMeta.ogDescription, username);
			const looksTruncated = /\.\.\.$|\s\.\.\.$|\bmore\b$/i.test(caption || "");
			if (!caption || looksTruncated || metaDescription.length > caption.length + 20) {
				caption = metaDescription || caption;
			}
		}

		const description = caption || "No description found.";
		const originalImageUrl = imageUrl;
		const cloudinaryImageUrl = toCloudinaryImageUrl(originalImageUrl);
		const postId = await generatePostId(description, sourceTitle, postDate);

		const altTextsUnique = Array.from(new Set(altTexts));
		const mediaType = isVideo && videoUrl ? "video" : imageUrl ? "image" : "unknown";

		return {
			sourceTitle,
			username,
			permalink,
			description,
			post_id: postId,
			isVideo,
			videoUrl,
			imageUrl: originalImageUrl,
			cloudinaryImageUrl,
			altTexts: altTextsUnique,
			postDate,
			isPrivate,
			mediaType
		};
	}

	function getOrCreateFloatingPanel(article) {
		if (!article) return null;
		let panel = article.querySelector(`.${PANEL_CLASS}`);
		if (!panel) {
			panel = document.createElement("div");
			panel.className = PANEL_CLASS;
			panel.innerHTML = `
				<div class="ig-post-viewer-panel-title">Post Output</div>
				<div class="ig-post-viewer-panel-body">Click "Show Post" to fetch and send data.</div>
			`;
			article.appendChild(panel);
		}
		return panel;
	}

	function buildWebhookPayload(data) {
		const mediaUrl = data.mediaType === "video" ? data.videoUrl || "" : data.imageUrl || "";
		const altText = Array.isArray(data.altTexts) ? data.altTexts.join(" | ") : "";
		return {
			post_id: data.post_id || "",
			caption: data.description || "",
			alt_text: altText || data.description || "",
			is_private: Boolean(data.isPrivate),
			media_type: data.mediaType || "unknown",
			media_url: mediaUrl,
			claimed_date: data.postDate || "",
			claimed_location: "",
			deep_mode: false
		};
	}

	async function sendPostPayloadToWebhook(data) {
		const payload = buildWebhookPayload(data);
		try {
			const result = await chrome.runtime.sendMessage({
				type: "SEND_POST_PAYLOAD",
				url: WEBHOOK_URL,
				payload
			});
			if (!result?.ok) {
				console.warn("Webhook POST failed", result);
			}
			return result || { ok: false, error: "No response from webhook relay" };
		} catch (error) {
			console.warn("Webhook POST error", error);
			return {
				ok: false,
				error: error?.message || String(error)
			};
		}
	}

	function renderResultInPanel(article, result) {
		const panel = getOrCreateFloatingPanel(article);
		if (!panel) return;
		const bodyText = typeof result?.body === "string" && result.body
			? result.body
			: JSON.stringify(result || {}, null, 2);
		panel.innerHTML = `
			<div class="ig-post-viewer-panel-title">Webhook Response</div>
			<div class="ig-post-viewer-panel-body">${`Status: ${result?.status ?? "N/A"}\nSuccess: ${result?.ok ? "Yes" : "No"}\n\n${bodyText}`.replace(/</g, "&lt;")}</div>
		`;
	}

	function findButtonContainer(article) {
		const header = article.querySelector("header");
		if (!header) return article;
		const nameAnchor = header.querySelector("a") || header.querySelector("h2") || header.firstElementChild;
		return nameAnchor?.parentElement || header;
	}

	function addButtonToArticle(article) {
		if (!article || article.dataset.igPostViewerButtonAdded === "1") return;

		const container = findButtonContainer(article);
		if (!container) return;

		const controls = document.createElement("span");
		controls.className = CONTROLS_CLASS;

		const tagA = document.createElement("span");
		tagA.className = "ig-post-mini-tag";
		tagA.textContent = "Extractor";

		const tagB = document.createElement("span");
		tagB.className = "ig-post-mini-tag";
		tagB.textContent = "Webhook";

		const button = document.createElement("button");
		button.type = "button";
		button.className = BTN_CLASS;
		button.textContent = "Show Post";
		button.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();
			const data = await extractPostData(article);
			const response = await sendPostPayloadToWebhook(data);
			renderResultInPanel(article, response);
		});

		controls.appendChild(tagA);
		controls.appendChild(tagB);
		controls.appendChild(button);
		container.appendChild(controls);
		getOrCreateFloatingPanel(article);
		article.dataset.igPostViewerButtonAdded = "1";
	}

	function injectButtons() {
		document.querySelectorAll("article").forEach(addButtonToArticle);
	}

	function start() {
		injectStyles();
		injectButtons();

		const observer = new MutationObserver(() => {
			injectButtons();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		// No modal behavior: results are displayed in floating per-post panels.
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start);
	} else {
		start();
	}
})();
