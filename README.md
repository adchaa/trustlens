/home/diden/Desktop/final/background.js# TrustLens - Content Authenticity Verification

A hackathon project for verifying digital content authenticity, detecting manipulation, AI-generated content, and misinformation.

## Quick Start

### 1. Set up your Gemini API Key

Get your API key from: https://ai.google.dev/

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or edit `backend/config.py` directly.

### 2. Start the Backend

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

The API will be available at: http://localhost:8000

### 3. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will be available at: http://localhost:3000

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/health` | GET | Detailed health check |
| `/analyze` | POST | Full content analysis |
| `/analyze/quick` | POST | Quick provenance check only |

## Project Structure

```
trustlens-starter/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── requirements.txt     # Python dependencies
│   ├── models/
│   │   └── schemas.py       # Pydantic models
│   └── services/
│       ├── provenance.py    # C2PA & EXIF extraction
│       ├── content_analysis.py  # AI manipulation detection
│       ├── context_check.py # Context verification
│       ├── source_check.py  # Source credibility
│       └── trust_card.py    # Final verdict generation
└── frontend/
    ├── package.json
    ├── src/
    │   ├── App.tsx          # Main application
    │   ├── components/
    │   │   ├── Upload.tsx   # File upload dropzone
    │   │   ├── Loading.tsx  # Loading animation
    │   │   └── TrustCard.tsx # Results display
    │   └── api/
    │       └── client.ts    # API client
    └── public/
```

## Features

### 1. Provenance Check
- C2PA Content Credentials detection
- EXIF metadata extraction
- Camera identification
- Timestamp verification

### 2. Content Analysis
- AI manipulation detection via Gemini
- Error Level Analysis (ELA)
- AI-generated content detection
- Deepfake indicators

### 3. Context Verification
- Caption vs. content matching
- Date plausibility check
- Location verification
- Reverse image search (placeholder)

### 4. Source Credibility
- Domain age check
- SSL certificate validation
- Suspicious URL pattern detection
- Fact-check database lookup

## Trust Card Output

The analysis produces a Trust Card with:
- **Verdict**: VERIFIED / UNCERTAIN / SUSPICIOUS
- **Confidence Score**: 0-100%
- **Summary Bullets**: Key findings
- **Detailed Scores**: Per-module scores
- **Full Analysis**: Expandable details

## Demo Test Cases

Prepare these for your demo:
1. **Authentic photo** - Should show VERIFIED
2. **Photoshopped image** - Should detect manipulation
3. **AI-generated image** - Should flag as AI-generated
4. **Real image + false caption** - Should detect context mismatch
5. **Content from suspicious URL** - Should show source warning

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `GOOGLE_CLOUD_API_KEY` | For Vision API (optional) | No |
| `GOOGLE_FACTCHECK_API_KEY` | For Fact Check API | No |

## Tech Stack

**Backend:**
- FastAPI (Python)
- c2pa-python (Content Credentials)
- google-generativeai (Gemini)
- Pillow, numpy (Image analysis)

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS
- Vite
- react-dropzone

## 24h Hackathon Timeline

| Hours | Focus |
|-------|-------|
| 0-2 | Setup, API keys |
| 2-6 | Backend core modules |
| 6-10 | Gemini integration |
| 10-14 | Frontend UI |
| 14-18 | Integration & testing |
| 18-22 | Polish & edge cases |
| 22-24 | Demo prep |

## License

MIT - Built for MENACRAFT Hackathon 2026
