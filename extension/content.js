// content.js - Instagram per-post extractor UI

(function initInstagramExtractor() {
	const STYLE_ID = "ig-post-viewer-style";
	const BTN_CLASS = "ig-post-viewer-btn";
	const PANEL_CLASS = "ig-post-viewer-panel";
	const CONTROLS_CLASS = "ig-post-viewer-controls";
	const WEBHOOK_URL = "https://scoldable-liza-semipervious.ngrok-free.dev/webhook-test/48250631-d225-4a3c-a10b-6fdb2edf046e";
	const USE_MOCK_RESPONSE = false;

	const MOCK_DEEP_RESPONSE_BODY = {
		mode: "deep",
		status: "COMPLETED",
		post_id: "518200ecd6cc283b645df61b",
		claim: "Major General Ali Abdullah Ali Abadi said Iran will turn the Strait of Hormuz into the gates of hell.",
		label: "FALSE",
		label_color: "red",
		label_score: null,
		confidence: 70,
		summary_bullets: ["No metadata found - possibly stripped"],
		forensics: {
			manipulation_detected: false,
			ai_generated: false,
			has_metadata: false,
			suspicious_signs: ["No metadata found - possibly stripped"],
			ela_suspicious: false
		},
		source: {
			domain: "instagram.com",
			has_ssl: true,
			credibility_score: 62
		},
		reasoning: "The post is dated April 04, 2026, which is in the future. News searches for 'Ali Abdollahi Ali Abadi Khatam al-Anbiya' yielded no results, indicating this general is not a recognized figure making such statements. While news searches for 'Iran Strait of Hormuz ultimatum Trump' returned numerous articles, these are also dated in March-April 2026, suggesting they are hypothetical or simulated future news. These articles describe a scenario where Donald Trump issues ultimatums to Iran regarding the Strait of Hormuz with 48-hour deadlines, but they do not mention Major General Ali Abdullah Ali Abadi as the source of the threat. Fact-check tools also returned no results for the general's name or the specific 'gates of hell' phrasing in this context. Therefore, the specific attribution of the threat to 'Major General Ali Abdullah Ali Abadi' is unverified and likely fabricated, making the entire claim false, especially considering its future date.",
		processing_time_ms: 6450
	};

	const MOCK_NORMAL_RESPONSE_BODY = {
		mode: "normal",
		status: "COMPLETED",
		post_id: "mock_normal_post_001",
		label: "MIXED",
		label_color: "orange",
		confidence: 58,
		reasoning: "Some parts match known reporting, but key attribution details are missing or inconsistent.",
		processing_time_ms: 1830
	};

	function injectStyles() {
		if (document.getElementById(STYLE_ID)) return;

		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			article[data-ig-post-viewer-button-added="1"] {
				position: relative;
			}

			.${CONTROLS_CLASS} {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
				margin-top: 8px;
			}

			.deep-mode-toggle {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				font-size: 12px;
				font-weight: 600;
				color: #374151;
				user-select: none;
			}

			.deep-mode-toggle input {
				width: 16px;
				height: 16px;
				accent-color: #111827;
			}

			.${BTN_CLASS} {
				background: #262626;
				color: #fff;
				border: none;
				border-radius: 6px;
				font-size: 12px;
				font-weight: 600;
				padding: 6px 12px;
				cursor: pointer;
				transition: background 0.2s ease;
			}

			.${BTN_CLASS}:hover {
				background: #404040;
			}

			.${BTN_CLASS}:disabled {
				background: #a3a3a3;
				cursor: not-allowed;
			}

			.${PANEL_CLASS} {
				position: absolute;
				top: 8px;
				right: -310px;
				width: 290px;
				max-height: 350px;
				overflow: auto;
				background: #ffffff;
				border: 1px solid #e5e5e5;
				border-radius: 12px;
				padding: 14px;
				box-sizing: border-box;
				z-index: 20;
				box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
				line-height: 1.5;
			}

			.${PANEL_CLASS}.fc-deep-mode {
				right: -360px;
				width: 340px;
				max-height: 420px;
				border-color: #dbeafe;
				box-shadow: 0 12px 28px rgba(30, 64, 175, 0.16);
			}

			.${PANEL_CLASS} .ig-post-viewer-panel-body {
				color: #262626;
				font-size: 13px;
			}

			.ig-post-viewer-panel-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				margin-bottom: 8px;
			}

			.ig-post-viewer-panel-title {
				font-size: 12px;
				font-weight: 700;
				color: #111827;
			}

			.ig-post-viewer-close {
				width: 24px;
				height: 24px;
				border: 1px solid #e5e7eb;
				border-radius: 6px;
				background: #fff;
				color: #6b7280;
				font-size: 16px;
				line-height: 1;
				cursor: pointer;
				padding: 0;
			}

			.ig-post-viewer-close:hover {
				background: #f9fafb;
				color: #111827;
			}

			/* Clean UI Elements for the Result */
			.fc-badge {
				display: inline-block;
				padding: 4px 8px;
				border-radius: 6px;
				font-weight: 700;
				font-size: 11px;
				margin-bottom: 12px;
				background: #4b5563;
				color: #fff;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}
			
			.fc-badge.true, .fc-badge.likely_true { background: #16a34a; }
			.fc-badge.false, .fc-badge.likely_false { background: #dc2626; }
			.fc-badge.mixed, .fc-badge.unverified { background: #d97706; }
			.fc-badge.unknown { background: #4b5563; }

			.fc-result-head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				margin-bottom: 10px;
			}

			.fc-confidence {
				font-weight: 700;
				font-size: 12px;
				color: #111827;
				white-space: nowrap;
			}

			.fc-confidence-track {
				height: 8px;
				background: #e5e7eb;
				border-radius: 999px;
				overflow: hidden;
				margin-bottom: 12px;
			}

			.fc-confidence-fill {
				height: 100%;
				background: linear-gradient(90deg, #f59e0b 0%, #22c55e 100%);
				border-radius: 999px;
			}

			.fc-meta {
				display: grid;
				grid-template-columns: 84px 1fr;
				gap: 4px 8px;
				font-size: 12px;
				margin: 10px 0;
				padding: 8px;
				border-radius: 8px;
				background: #fafafa;
				border: 1px solid #f0f0f0;
			}

			.fc-meta-key {
				font-weight: 700;
				color: #374151;
			}

			.fc-raw {
				font-size: 12px;
				color: #6b7280;
				background: #f9fafb;
				border: 1px solid #eceff3;
				padding: 8px;
				border-radius: 8px;
				margin-top: 8px;
				white-space: pre-wrap;
				word-break: break-word;
			}

			.fc-section {
				margin-top: 10px;
				padding-top: 10px;
				border-top: 1px dashed #e5e7eb;
			}

			.fc-section-title {
				font-size: 12px;
				font-weight: 700;
				color: #111827;
				margin-bottom: 6px;
			}

			.fc-list {
				margin: 0;
				padding-left: 16px;
				color: #374151;
				font-size: 12px;
			}

			.fc-list li {
				margin-bottom: 3px;
			}

			.fc-claim {
				font-weight: 600;
				font-size: 14px;
				margin-bottom: 8px;
				color: #111;
			}

			.fc-reasoning {
				font-size: 13px;
				color: #525252;
				background: #f5f5f5;
				padding: 10px;
				border-radius: 8px;
				margin-top: 8px;
			}

			.fc-loading {
				display: flex;
				align-items: center;
				gap: 8px;
				color: #525252;
				font-weight: 500;
			}

			.fc-error {
				color: #dc2626;
				background: #fef2f2;
				padding: 10px;
				border-radius: 8px;
				font-weight: 500;
			}

			.fc-deep-shell {
				background: linear-gradient(180deg, #eff6ff 0%, #ffffff 38%);
				border: 1px solid #dbeafe;
				border-radius: 10px;
				padding: 10px;
			}

			.fc-deep-head {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 8px;
				margin-bottom: 10px;
			}

			.fc-deep-kicker {
				font-size: 11px;
				font-weight: 700;
				color: #1e40af;
				text-transform: uppercase;
				letter-spacing: 0.4px;
			}

			.fc-deep-score {
				font-size: 12px;
				font-weight: 700;
				color: #1f2937;
			}

			.fc-deep-grid {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 8px;
				margin-top: 10px;
			}

			.fc-deep-card {
				background: #fff;
				border: 1px solid #e5e7eb;
				border-radius: 8px;
				padding: 8px;
			}

			.fc-deep-card-title {
				font-size: 11px;
				font-weight: 700;
				color: #374151;
				margin-bottom: 3px;
				text-transform: uppercase;
			}

			.fc-deep-card-value {
				font-size: 13px;
				font-weight: 700;
				color: #111827;
			}

			.fc-deep-reasoning {
				margin-top: 10px;
				background: #ffffff;
				border: 1px solid #e5e7eb;
				border-left: 4px solid #1d4ed8;
				border-radius: 8px;
				padding: 10px;
				font-size: 12px;
				color: #374151;
			}

			.fc-deep-debug {
				margin-top: 10px;
				font-size: 12px;
			}

			.fc-deep-debug summary {
				cursor: pointer;
				font-weight: 700;
				color: #374151;
			}

			.fc-normal-shell {
				background: #ffffff;
				border: 1px solid #e5e7eb;
				border-radius: 10px;
				padding: 10px;
			}

			.fc-normal-lead {
				font-size: 12px;
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.35px;
				color: #374151;
				margin-bottom: 8px;
			}

			.fc-kv-grid {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 8px;
				margin-top: 10px;
			}

			.fc-kv-box {
				background: #f9fafb;
				border: 1px solid #edf0f3;
				border-radius: 8px;
				padding: 8px;
			}

			.fc-kv-box-wide {
				grid-column: 1 / -1;
				min-height: 74px;
			}

			.fc-kv-label {
				font-size: 11px;
				font-weight: 700;
				color: #6b7280;
				text-transform: uppercase;
				margin-bottom: 3px;
			}

			.fc-kv-value {
				font-size: 12px;
				font-weight: 600;
				color: #111827;
				word-break: break-word;
			}

			.fc-evidence-block {
				margin-top: 10px;
				border: 1px solid #edf0f3;
				border-radius: 8px;
				padding: 8px;
				background: #fcfcfd;
			}

			.fc-evidence-item + .fc-evidence-item {
				margin-top: 8px;
				padding-top: 8px;
				border-top: 1px dashed #e5e7eb;
			}

			.fc-evidence-key {
				font-size: 11px;
				font-weight: 700;
				text-transform: uppercase;
				color: #374151;
				margin-bottom: 4px;
			}

			.fc-evidence-text {
				font-size: 12px;
				color: #374151;
				line-height: 1.45;
			}

			@media (max-width: 1350px) {
				.${PANEL_CLASS} {
					right: 12px;
					top: 52px;
					width: 260px;
				}

				.${PANEL_CLASS}.fc-deep-mode {
					right: 12px;
					top: 52px;
					width: 300px;
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

	function extractClaimedDate(text, fallbackDate) {
		const source = (text || "").replace(/\s+/g, " ").trim();
		if (!source) return fallbackDate || "";

		const isoMatch = source.match(/\b(\d{4}-\d{2}-\d{2})\b/);
		if (isoMatch?.[1]) return isoMatch[1];

		const slashMatch = source.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
		if (slashMatch) {
			const mm = slashMatch[1].padStart(2, "0");
			const dd = slashMatch[2].padStart(2, "0");
			const yyyy = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
			return `${yyyy}-${mm}-${dd}`;
		}

		const writtenMatch = source.match(/\b(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?\b/i);
		if (writtenMatch?.[0]) return writtenMatch[0].trim();

		return fallbackDate || "";
	}

	function extractClaimedLocation(text) {
		const source = (text || "").replace(/\s+/g, " ").trim();
		if (!source) return "";

		const pinMatch = source.match(/(?:📍|location\s*[:\-]?\s*)([^.,;|\n]{2,80})/i);
		if (pinMatch?.[1]) return pinMatch[1].trim();

		const prepositionMatch = source.match(/\b(?:in|at|from)\s+([A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*){0,4})\b/);
		if (prepositionMatch?.[1]) {
			const candidate = prepositionMatch[1].trim();
			if (!/\b(?:Instagram|Reels?|Post|Video|Photo)\b/i.test(candidate)) {
				return candidate;
			}
		}

		return "";
	}

	function sanitizePageTitle(rawTitle, username) {
		let text = (rawTitle || "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "").replace(/\s+/g, " ").trim();
		if (!text) return "";

		text = text.replace(/\s*[|-]\s*Instagram\s*$/i, "").trim();
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

		if (!postDate && remoteMeta.publishedTime) postDate = remoteMeta.publishedTime;

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

		const captionText = caption || "No description found.";
		const claimedDate = extractClaimedDate(captionText, postDate);
		const claimedLocation = extractClaimedLocation(`${captionText} ${altTexts.join(" ")}`);
		const originalImageUrl = imageUrl;
		const cloudinaryImageUrl = toCloudinaryImageUrl(originalImageUrl);
		const postId = await generatePostId(captionText, sourceTitle, postDate);

		const altTextsUnique = Array.from(new Set(altTexts));
		const mediaType = isVideo && videoUrl ? "video" : imageUrl ? "image" : "unknown";

		return {
			sourceTitle,
			username,
			permalink,
			caption: captionText,
			post_id: postId,
			isVideo,
			videoUrl,
			imageUrl: originalImageUrl,
			cloudinaryImageUrl,
			altTexts: altTextsUnique,
			postDate,
			claimedDate,
			claimedLocation,
			isPrivate,
			mediaType
		};
	}

	function buildWebhookPayload(data, deepModeEnabled = false) {
		const mediaUrl = data.mediaType === "video" ? data.videoUrl || "" : data.imageUrl || "";
		const altText = Array.isArray(data.altTexts) ? data.altTexts.join(" | ") : "";
		return {
			post_id: data.post_id || "",
			title: data.sourceTitle || data.username || "",
			caption: data.caption || "",
			alt_text: altText || data.caption || "",
			is_private: Boolean(data.isPrivate),
			media_type: data.mediaType || "unknown",
			media_url: mediaUrl,
			claimed_date: data.claimedDate || data.postDate || "",
			claimed_location: data.claimedLocation || "",
			deep_mode: Boolean(deepModeEnabled)
		};
	}

	async function sendPostPayloadToWebhook(data, deepModeEnabled = false) {
		const payload = buildWebhookPayload(data, deepModeEnabled);
		try {
			const result = await chrome.runtime.sendMessage({
				type: "SEND_POST_PAYLOAD",
				url: WEBHOOK_URL,
				payload
			});
			return result || { ok: false, error: "No response from webhook relay" };
		} catch (error) {
			return { ok: false, error: error?.message || String(error) };
		}
	}

	function getMockWebhookResponse(deepModeEnabled = false) {
		return {
			ok: true,
			status: 200,
			url: "mock://local-preview",
			body: deepModeEnabled ? MOCK_DEEP_RESPONSE_BODY : MOCK_NORMAL_RESPONSE_BODY
		};
	}

	function escapeHtml(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	function unwrapAnalysisResponse(input) {
		if (!input || typeof input !== "object") return null;

		if (input.trust_card) return input;

		const candidateKeys = [
			"analysis_response",
			"AnalysisResponse",
			"ANALYSERESPONSE",
			"analyseresponse",
			"result",
			"data",
			"output",
			"response"
		];

		for (const key of candidateKeys) {
			const value = input[key];
			if (value && typeof value === "object") {
				if (value.trust_card) return value;
				const nested = unwrapAnalysisResponse(value);
				if (nested) return nested;
			}
		}

		if (Array.isArray(input) && input.length) {
			for (const item of input) {
				const nested = unwrapAnalysisResponse(item);
				if (nested) return nested;
			}
		}

		for (const value of Object.values(input)) {
			if (value && typeof value === "object") {
				const nested = unwrapAnalysisResponse(value);
				if (nested) return nested;
			}
		}

		return input;
	}

	function tryParseJsonFromText(text) {
		if (!text || typeof text !== "string") return null;

		try {
			return JSON.parse(text);
		} catch {
			const firstBrace = text.indexOf("{");
			const lastBrace = text.lastIndexOf("}");
			if (firstBrace >= 0 && lastBrace > firstBrace) {
				const candidate = text.slice(firstBrace, lastBrace + 1);
				try {
					return JSON.parse(candidate);
				} catch {
					return null;
				}
			}
			return null;
		}
	}

	function normalizeReplyFields(responseData = {}) {
		const toolEvidence = (responseData.tool_evidence && typeof responseData.tool_evidence === "object")
			? responseData.tool_evidence
			: {};

		return {
			post_id: responseData.post_id,
			claim_detected: responseData.claim_detected,
			category: responseData.category,
			confidence: responseData.confidence,
			reasoning: responseData.reasoning,
			fact_check: responseData.fact_check ?? toolEvidence.fact_check,
			news_sources: responseData.news_sources ?? toolEvidence.news_sources,
			caption: responseData.caption,
			alt_text: responseData.alt_text,
			deep_mode: responseData.deep_mode,
			claimed_date: responseData.claimed_date,
			claimed_location: responseData.claimed_location,
			media_url: responseData.media_url
		};
	}

	function warnMissingReplyFields(normalizedReply) {
		const requiredKeys = [
			"post_id",
			"claim_detected",
			"category",
			"confidence",
			"reasoning",
			"fact_check",
			"news_sources",
			"caption",
			"alt_text",
			"deep_mode",
			"claimed_date",
			"claimed_location",
			"media_url"
		];

		const missing = requiredKeys.filter((key) => {
			const value = normalizedReply[key];
			return value == null || (typeof value === "string" && value.trim() === "");
		});

		if (missing.length) {
			console.warn("API reply is missing expected fields:", missing, normalizedReply);
		}
	}

	// --- CLEAN UI RENDERING ---

	function getOrCreateFloatingPanel(article) {
		if (!article) return null;
		let panel = article.querySelector(`.${PANEL_CLASS}`);
		if (!panel) {
			panel = document.createElement("div");
			panel.className = PANEL_CLASS;
			panel.innerHTML = `
				<div class="ig-post-viewer-panel-header">
					<div class="ig-post-viewer-panel-title">Fact Check</div>
					<button type="button" class="ig-post-viewer-close" data-role="panel-close-btn" aria-label="Close">&times;</button>
				</div>
				<div class="ig-post-viewer-panel-body">Click "Analyze Post" to run fact check.</div>
				<div class="${CONTROLS_CLASS}">
					<label class="deep-mode-toggle" title="Enable deeper analysis">
						<input type="checkbox" data-role="deep-mode-toggle" />
						<span>Deep Mode</span>
					</label>
					<button type="button" class="${BTN_CLASS}" data-role="show-post-btn">Analyze Post</button>
				</div>
			`;
			article.appendChild(panel);
		}
		return panel;
	}

	function resetPanelToDefault(article) {
		const panel = getOrCreateFloatingPanel(article);
		if (!panel) return;

		panel.classList.remove("fc-deep-mode");
		const panelBody = panel.querySelector(".ig-post-viewer-panel-body");
		if (panelBody) {
			panelBody.textContent = 'Click "Analyze Post" to run fact check.';
		}

		const button = panel.querySelector('[data-role="show-post-btn"]');
		if (button) {
			button.disabled = false;
			button.textContent = "Analyze Post";
		}
	}

	function renderSendingState(article) {
		const panel = getOrCreateFloatingPanel(article);
		if (!panel) return;
		const panelBody = panel.querySelector(".ig-post-viewer-panel-body");
		if (panelBody) {
			panelBody.innerHTML = `
				<div class="fc-loading">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
					Analyzing claim...
				</div>
			`;
		}
	}

	function renderResultInPanel(article, result, deepModeEnabled = false, requestPayload = null, extractedPostData = null) {
		const panel = getOrCreateFloatingPanel(article);
		if (!panel) return;
		
		const panelBody = panel.querySelector(".ig-post-viewer-panel-body");
		if (!panelBody) return;

		// Handle Request Error
		if (!result || !result.ok) {
			panel.classList.remove("fc-deep-mode");
			panelBody.innerHTML = `
				<div class="fc-error">
					Fact check failed: ${escapeHtml(result?.error || "Unknown error")}${result?.status ? ` (Status ${escapeHtml(result.status)})` : ""}
				</div>
			`;
			return;
		}

		let responseData = {};
		const rawBody = typeof result.body === "string" ? result.body.trim() : "";
		if (result.body && typeof result.body === "object") {
			responseData = result.body;
		} else if (rawBody) {
			responseData = tryParseJsonFromText(rawBody) || { raw_body: rawBody };
		}
		responseData = responseData || {};
		const normalizedReply = normalizeReplyFields(responseData);
		console.log("Normalized API reply fields:", normalizedReply);
		warnMissingReplyFields(normalizedReply);

		const trustCard = responseData?.trust_card || null;
		const categoryStr = String(normalizedReply.category || "").toUpperCase();
		const categoryClass = categoryStr ? categoryStr.toLowerCase() : "unknown";
		const confidenceRaw = normalizedReply.confidence;
		const confidenceNumeric = Number.isFinite(Number(confidenceRaw))
			? Number(confidenceRaw)
			: null;
		const confidencePercent = confidenceNumeric == null
			? null
			: confidenceNumeric <= 1
				? Math.round(confidenceNumeric * 100)
				: Math.max(0, Math.min(100, Math.round(confidenceNumeric)));
		const confidence = confidencePercent == null ? "N/A" : `${confidencePercent}%`;
		const displayCategory = categoryStr ? categoryStr.replace(/_/g, " ") : "-";
		const reasoning = normalizedReply.reasoning || "";
		const bodyPreview = rawBody || "(empty response body)";
		const processingTime = responseData.processing_time_ms;
		const responseMode = responseData.mode;
		const responseStatus = responseData.status;
		const claimedDateValue = normalizedReply.claimed_date || "-";
		const factCheckValue = normalizedReply.fact_check || "-";
		const newsSourcesValue = normalizedReply.news_sources || "-";
		const labelColor = String(responseData.label_color || "").toLowerCase();
		const badgeInlineStyle = labelColor
			? ` style="background:${labelColor === "red" ? "#dc2626" : labelColor === "green" ? "#16a34a" : labelColor === "orange" ? "#d97706" : labelColor === "yellow" ? "#ca8a04" : labelColor};"`
			: "";

		const renderBool = (value) => value === true ? "Yes" : value === false ? "No" : "N/A";
		const renderList = (items = []) => Array.isArray(items) && items.length
			? `<ul class="fc-list">${items.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</li>`).join("")}</ul>`
			: `<div class="fc-raw">No items</div>`;
		const renderField = (label, value) => `
			<div class="fc-kv-box">
				<div class="fc-kv-label">${escapeHtml(label)}</div>
				<div class="fc-kv-value">${escapeHtml(value == null || value === "" ? "-" : String(value))}</div>
			</div>
		`;
		const renderWideField = (label, value) => `
			<div class="fc-kv-box fc-kv-box-wide">
				<div class="fc-kv-label">${escapeHtml(label)}</div>
				<div class="fc-kv-value">${escapeHtml(value == null || value === "" ? "-" : String(value))}</div>
			</div>
		`;

		const isDeepResponse = deepModeEnabled
			|| String(responseMode || "").toLowerCase() === "deep"
			|| Boolean(trustCard);

		if (isDeepResponse) {
			panel.classList.add("fc-deep-mode");
			const deepLabel = responseData.label || "-";
			const deepLabelClass = String(deepLabel).toLowerCase();
			const deepLabelDisplay = String(deepLabel).toUpperCase();
			const deepConfidence = responseData.confidence;
			const deepConfidenceDisplay = deepConfidence == null ? "-" : String(deepConfidence);
			const deepClaimedDate = extractedPostData?.claimedDate || extractedPostData?.postDate || "-";
			const aiGeneratedRaw = responseData.forensics?.ai_generated;
			const aiGeneratedDisplay = aiGeneratedRaw === true ? "Yes" : aiGeneratedRaw === false ? "No" : "-";
			const labelScoreRaw = responseData.label_score;
			const labelScoreDisplay = labelScoreRaw == null ? "-" : String(labelScoreRaw);
			const labelScoreNumeric = Number(labelScoreRaw);
			const labelScorePercent = Number.isFinite(labelScoreNumeric)
				? Math.max(0, Math.min(100, Math.round(labelScoreNumeric <= 1 ? labelScoreNumeric * 100 : labelScoreNumeric)))
				: 0;

			panelBody.innerHTML = `
				<div class="fc-deep-shell">
					<div class="fc-deep-head">
						<div class="fc-deep-kicker">Deep Mode Analysis</div>
						<div class="fc-deep-score">Confidence: ${escapeHtml(deepConfidenceDisplay)}</div>
					</div>
					<div class="fc-result-head">
						<div class="fc-badge ${deepLabelClass}"${badgeInlineStyle}>${escapeHtml(deepLabelDisplay)}</div>
						<div class="fc-confidence">${escapeHtml(String(responseStatus || "COMPLETED"))}</div>
					</div>
					<div class="fc-confidence-track">
						<div class="fc-confidence-fill" style="width: ${labelScorePercent}%;"></div>
					</div>

					<div class="fc-kv-grid">
						${renderField("label", deepLabelDisplay)}
						${renderField("claimed date", deepClaimedDate)}
						${renderField("ai_generated", aiGeneratedDisplay)}
						${renderField("label_score", labelScoreDisplay)}
					</div>

					${reasoning ? `<div class="fc-deep-reasoning">${escapeHtml(reasoning)}</div>` : ""}

				</div>
			`;
			return;
		}

		panel.classList.remove("fc-deep-mode");

		panelBody.innerHTML = `
			<div class="fc-normal-shell">
				<div class="fc-normal-lead">Fact Check Result</div>
				<div class="fc-result-head">
					<div class="fc-badge ${categoryClass}"${badgeInlineStyle}>${displayCategory}</div>
					<div class="fc-confidence">Confidence: ${escapeHtml(normalizedReply.confidence != null ? String(normalizedReply.confidence) : confidence)}</div>
				</div>
				<div class="fc-confidence-track">
					<div class="fc-confidence-fill" style="width: ${confidencePercent == null ? 0 : confidencePercent}%;"></div>
				</div>

				<div class="fc-kv-grid">
					${renderField("category", normalizedReply.category || categoryStr)}
					${renderField("claimed date", claimedDateValue)}
					${renderWideField("fact_check", factCheckValue)}
					${renderWideField("news_sources", newsSourcesValue)}
				</div>
			</div>
		`;
	}

	function addButtonToArticle(article) {
		if (!article || article.dataset.igPostViewerButtonAdded === "1") return;

		const panel = getOrCreateFloatingPanel(article);
		if (!panel) return;

		const button = panel.querySelector('[data-role="show-post-btn"]');
		const deepModeToggle = panel.querySelector('[data-role="deep-mode-toggle"]');
		const closeBtn = panel.querySelector('[data-role="panel-close-btn"]');

		if (closeBtn && closeBtn.dataset.bound !== "1") {
			closeBtn.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				resetPanelToDefault(article);
			});
			closeBtn.dataset.bound = "1";
		}

		if (deepModeToggle && deepModeToggle.dataset.bound !== "1") {
			deepModeToggle.addEventListener("change", (event) => {
				const checkbox = event.target;
				if (!checkbox?.checked) return;
				const accepted = window.confirm("Deep Mode is a subscriber feature. Click OK to continue anyway (mock).\n\nDo you want to proceed?");
				if (!accepted) {
					checkbox.checked = false;
				}
			});
			deepModeToggle.dataset.bound = "1";
		}

		if (!button || button.dataset.bound === "1") {
			article.dataset.igPostViewerButtonAdded = "1";
			return;
		}

		button.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();
			button.disabled = true;
			button.textContent = "Analyzing...";
			const deepModeEnabled = Boolean(deepModeToggle?.checked);

			const data = await extractPostData(article);
			console.log("Extracted post data:", data);
			const requestPayload = buildWebhookPayload(data, deepModeEnabled);
			renderSendingState(article);
			const response = USE_MOCK_RESPONSE
				? getMockWebhookResponse(deepModeEnabled)
				: await sendPostPayloadToWebhook(data, deepModeEnabled);
			renderResultInPanel(article, response, deepModeEnabled, requestPayload, data);
			button.disabled = false;
			button.textContent = "Analyze Again";
		});
		button.dataset.bound = "1";
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
		
		// Setup simple spinner animation in style tag
		const style = document.getElementById(STYLE_ID);
		if (style && !style.textContent.includes('@keyframes spin')) {
			style.textContent += `
				@keyframes spin { 100% { transform: rotate(360deg); } }
				.spin { animation: spin 1s linear infinite; }
			`;
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start);
	} else {
		start();
	}
})();