# TrustLens - Social Media Content Authenticity Verification

A misinformation detection system that analyzes social media posts (currently Instagram) for authenticity. It combines AI-powered content analysis, fact-checking APIs, and forensic techniques to generate trust scores.

# presentation link
https://www.canva.com/design/DAHF9Qwpa3Y/fubTfUgkV-lDdhFiLtF0YA/edit

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Chrome Ext.    │────▶│   n8n Workflow  │────▶│  Backend API    │
│  (final/)       │     │   (n8n/)        │     │  (backend/)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Extracts              Classifies &           Deep forensic
     post data             fact-checks            analysis
```

| Component | Description |
|-----------|-------------|
| `backend/` | FastAPI service for content forensics (C2PA, EXIF, AI detection, manipulation analysis) |
| `final/` | Chrome extension that extracts Instagram post data and triggers analysis |
| `n8n/` | Workflow automation that orchestrates fact-checking and trust classification |

---

## Quick Start Guide

### Prerequisites

- Python 3.10+
- Node.js 18+ (optional, for Cloudinary uploads)
- Google Chrome browser
- n8n instance (cloud or self-hosted)
- API Keys:
  - **Gemini API Key** (required) - [Get it here](https://aistudio.google.com/app/apikey)
  - **News API Key** (optional) - [Get it here](https://newsapi.org/)
  - **Google Fact Check API Key** (optional) - [Get it here](https://console.cloud.google.com/)

---

## 1. Backend API Setup (`backend/`)

The FastAPI backend performs deep content analysis including:
- **Provenance Check**: C2PA credentials, EXIF metadata extraction
- **Content Analysis**: AI-generated content detection, manipulation detection
- **Context Verification**: Caption vs. image consistency
- **Source Credibility**: Domain reputation check

### Installation

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Create a `.env` file in `backend/`:

```env
GEMINI_API_KEY=your-gemini-api-key-here
GOOGLE_CLOUD_API_KEY=your-google-cloud-key      # Optional
GOOGLE_FACTCHECK_API_KEY=your-factcheck-key     # Optional
```

### Run the Server

```bash
python main.py
```

The API will start at `http://localhost:8000`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check, returns service info |
| `/health` | GET | Detailed health status |
| `/analyze` | POST | Analyze content from URL |

### Test the API

```bash
# Health check
curl http://localhost:8000/health

# Analyze an image
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "file_url": "https://example.com/image.jpg",
    "caption": "Breaking news: Example event",
    "alt_text": "Photo of example"
  }'
```

### Backend Project Structure

```
backend/
├── main.py              # FastAPI application entry point
├── config.py            # Configuration and environment variables
├── requirements.txt     # Python dependencies
├── models/
│   └── schemas.py       # Pydantic data models
├── services/
│   ├── provenance.py    # C2PA and EXIF analysis
│   ├── content_analysis.py  # AI/manipulation detection
│   ├── context_check.py # Caption-image verification
│   ├── source_check.py  # Domain credibility
│   └── trust_card.py    # Final score generation
└── uploads/             # Temporary file storage
```

---

## 2. Chrome Extension Setup (`final/`)

The Chrome extension adds a "Show Post" button to Instagram posts, extracts post data, and sends it for analysis.

### Features

- Extracts caption, alt text, images/videos from Instagram posts
- Detects claimed dates and locations from text
- Sends data to n8n webhook for processing
- Displays analysis results in a floating panel

### Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `final/` folder
5. The extension icon should appear in your toolbar

### Configuration

Edit `content.js` line 8 to set your webhook URL:

```javascript
const WEBHOOK_URL = "https://your-n8n-instance.com/webhook/your-webhook-id";
```

### Usage

1. Go to [Instagram](https://www.instagram.com/)
2. Scroll to any post in your feed
3. Click the **"Show Post"** button that appears near the username
4. The extension will:
   - Extract post data (caption, image, metadata)
   - Send it to the n8n webhook
   - Display the analysis result in a floating panel

### Extension Project Structure

```
final/
├── manifest.json        # Extension configuration (Manifest V3)
├── background.js        # Service worker for API calls
├── content.js           # Instagram page injection script
├── popup.html           # Extension popup UI
├── popup.js             # Popup logic
├── claudinary.js        # Cloudinary upload utility
├── package.json         # Node dependencies (for Cloudinary)
└── icons/               # Extension icons
```

---

## 3. n8n Workflow Setup (`n8n/`)

The n8n workflow orchestrates the trust analysis pipeline:

1. **Privacy Gate** - Skips private accounts
2. **News Detection** - Filters non-news content
3. **Trust Classifier Agent** - Uses Gemini AI + fact-check APIs to classify posts
4. **Deep Mode** - Optionally calls the backend API for forensic analysis

### Workflow Flow

```
Webhook → Privacy Check → News Check → Trust Classifier → Deep Mode?
                                              │                │
                                              ▼                ▼
                                         Return Result    Call Backend API
                                                              │
                                                              ▼
                                                      Compute Deep Score
                                                              │
                                                              ▼
                                                        Return Result
```

### Import the Workflow

1. Open your n8n instance
2. Go to **Workflows** → **Import from File**
3. Select `n8n/Social_Media_Post_Trust_Analysis_Gemini.json`
4. Click **Import**

### Configure Credentials

After importing, set up these credentials in n8n:

1. **Google Gemini API**
   - Go to **Credentials** → **Add Credential**
   - Select **Google PaLM API**
   - Enter your Gemini API key

2. **Update Webhook URLs**
   - In the "Microservice Call" node, update the URL to your backend API:
     ```
     http://localhost:8000/analyze
     ```
   - Or use a tunnel like ngrok: `https://your-tunnel.ngrok.io/analyze`

3. **API Keys in HTTP Request Nodes** (already configured, but verify):
   - News API key in "News API Tool" node
   - Google Fact Check API key in "Fact Check Tool" node

### Activate the Workflow

1. Click **Active** toggle in the top-right
2. Copy the webhook URL from the "Webhook" node
3. Update the Chrome extension's `WEBHOOK_URL` with this URL

### Trust Categories

The workflow classifies posts into these categories:

| Category | Score Range | Description |
|----------|-------------|-------------|
| `VERIFIED_TRUE` | 80-100 | Confirmed by credible sources |
| `PARTIALLY_TRUE` | 60-79 | Mostly accurate, minor issues |
| `UNVERIFIED` | 40-59 | Insufficient evidence |
| `MISLEADING` | 20-39 | Partial misinformation or misleading context |
| `FALSE` | 0-19 | Confirmed misinformation |
| `MANIPULATED_CONTENT` | - | Image/video manipulation detected |

---

## End-to-End Testing

### Step 1: Start the Backend

```bash
cd backend
source venv/bin/activate
python main.py
```

### Step 2: Expose Backend (if n8n is remote)

```bash
# Using ngrok
ngrok http 8000
# Copy the https URL
```

### Step 3: Configure n8n

1. Update the "Microservice Call" node URL to your backend
2. Activate the workflow
3. Copy the webhook URL

### Step 4: Configure Extension

1. Update `WEBHOOK_URL` in `content.js`
2. Reload the extension in Chrome

### Step 5: Test

1. Go to Instagram
2. Find a news-related post
3. Click "Show Post"
4. View the trust analysis result

---

## Demo Test Cases

Prepare these for your demo:
1. **Authentic photo** - Should show VERIFIED
2. **Photoshopped image** - Should detect manipulation
3. **AI-generated image** - Should flag as AI-generated
4. **Real image + false caption** - Should detect context mismatch
5. **Content from suspicious URL** - Should show source warning

---

## Troubleshooting

### Backend Issues

| Problem | Solution |
|---------|----------|
| `GEMINI_API_KEY not set` | Check `.env` file exists and has valid key |
| `File too large` | Reduce image size or increase `MAX_FILE_SIZE_MB` in `config.py` |
| `Download timed out` | Image URL may be blocked; try a different image |

### Extension Issues

| Problem | Solution |
|---------|----------|
| Button doesn't appear | Refresh Instagram; check extension is enabled |
| Webhook fails | Verify webhook URL is correct and n8n workflow is active |
| CORS error | Ensure backend has CORS enabled (it does by default) |

### n8n Issues

| Problem | Solution |
|---------|----------|
| Workflow not triggering | Check webhook is active; verify URL in extension |
| Gemini errors | Check API key in credentials; verify quota |
| No fact-check results | Some claims may not have existing fact-checks |

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `GOOGLE_CLOUD_API_KEY` | For Vision API (optional) | No |
| `GOOGLE_FACTCHECK_API_KEY` | For Fact Check API | No |

---

## Tech Stack

| Component | Technologies |
|-----------|--------------|
| Backend | Python, FastAPI, Gemini AI, Pillow, OpenCV, c2pa-python |
| Extension | JavaScript, Chrome Manifest V3, Cloudinary |
| Workflow | n8n, Gemini 2.5 Flash, News API, Google Fact Check API |

---

## Trust Card Output

The analysis produces a Trust Card with:
- **Verdict**: VERIFIED / UNCERTAIN / SUSPICIOUS
- **Confidence Score**: 0-100%
- **Summary Bullets**: Key findings
- **Detailed Scores**: Per-module scores (provenance, content, context, source)
- **Full Analysis**: Expandable details

---

## License

MIT - Built for MENACRAFT Hackathon 2026
