# TrustLens Backend Architecture

## Overview

TrustLens is a content authenticity verification service built with FastAPI. The backend accepts uploaded media files, runs multiple analysis modules, and returns a trust verdict with detailed scores.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | FastAPI + Uvicorn |
| AI/ML | Google Gemini (gemini-2.5-flash) |
| Image Processing | PIL, numpy, exifread |
| Content Credentials | c2pa-python (optional) |
| Source Verification | python-whois, requests |
| Validation | Pydantic |

See `backend/requirements.txt` for the full dependency list.

## Request Flow

```
Frontend                      Backend                       Analysis Pipeline
   |                            |                                 |
   |-- POST /analyze (file) --->|                                 |
   |  + caption                |                                 |
   |  + claimed_date           |                                 |
   |  + claimed_location       |                                 |
   |  + source_url             |                                 |
   |                            |                                 |
   |                    validate_file()                          |
   |                    save temp file                           |
   |                            |                                 |
   |                            |------> check_provenance()      |
   |                            |      (C2PA + EXIF)              |
   |                            |                                 |
   |                            |------> analyze_content()       |
   |                            |      (ELA + Gemini)             |
   |                            |                                 |
   |                            |------> verify_context()        |
   |                            |      (Gemini)                   |
   |                            |                                 |
   |                            |------> check_source()           |
   |                            |      (WHOIS + SSL)              |
   |                            |                                 |
   |                            |---> generate_trust_card()      |
   |                            |      (weighted scoring)         |
   |                            |                                 |
   |<-- AnalysisResponse ----- |                                 |
         + trust_card                                          |
```

## API Endpoints

### POST /analyze

Full analysis endpoint accepting multipart form data.

**Request:**
```
file: UploadFile (required)
caption: string (optional)
claimed_date: string (optional)
claimed_location: string (optional)
source_url: string (optional)
```

**Response:** `AnalysisResponse`
```python
{
  "success": bool,
  "file_name": str,
  "file_type": str,
  "trust_card": TrustCard,
  "processing_time_ms": int
}
```

### POST /analyze/quick

Lightweight endpoint that only runs provenance check.

### GET /health

Health check verifying:
- Upload directory exists
- GEMINI_API_KEY is configured

### GET /

Basic service metadata endpoint.

## Analysis Modules

### 1. Provenance (`backend/services/provenance.py`)

Checks for origin metadata in media files.

**What it does:**
- Extracts C2PA (Content Credentials) if present
- Extracts EXIF metadata (camera, timestamp, GPS, software)
- Detects suspicious patterns (editing software, invalid timestamps)

**Returns:** `ProvenanceResult`
- `has_c2pa`: bool
- `has_exif`: bool
- `c2pa_valid`: bool | None
- `camera`: str | None
- `timestamp`: str | None
- `gps`: dict | None
- `suspicious_signs`: list
- `provenance_score`: int (0-100)

### 2. Content Analysis (`backend/services/content_analysis.py`)

Detects manipulation and AI-generated content.

**Techniques:**
- **Error Level Analysis (ELA):** Re-saves JPEG and compares compression differences. High variance in error levels suggests manipulation.
- **Gemini Vision:** Sends image to Gemini with a forensic prompt asking for manipulation and AI-generation signs.

**Returns:** `ContentAnalysisResult`
- `manipulation_detected`: bool
- `ai_generated`: bool
- `confidence`: int (0-100)
- `manipulation_signs`: list
- `ai_generation_signs`: list
- `ela_suspicious`: bool

### 3. Context Verification (`backend/services/context_check.py`)

Verifies if content matches user-provided claims.

**What it checks:**
- Does the caption match the image content?
- Does the claimed date match visual clues (technology, fashion, signage)?
- Does the claimed location match visual evidence?

**Returns:** `ContextResult`
- `context_match`: bool
- `confidence`: int (0-100)
- `caption_matches_content`: bool
- `date_appears_consistent`: bool | None
- `location_appears_consistent`: bool | None
- `detected_elements`: list
- `inconsistencies`: list

**Note:** Reverse image search is not implemented (placeholder).

### 4. Source Credibility (`backend/services/source_check.py`)

Evaluates trustworthiness of provided source URLs.

**What it checks:**
- Domain age via WHOIS
- SSL certificate validity
- Suspicious URL patterns (typosquatting, free TLDs, excessive subdomains)
- Google Fact Check API for claim verification

**Returns:** `SourceResult`
- `domain`: str | None
- `domain_age_days`: int | None
- `has_ssl`: bool
- `suspicious_patterns`: list
- `credibility_score`: int (0-100)

## Trust Card Generation (`backend/services/trust_card.py`)

Combines all analysis results into a final verdict.

### Score Weights

Defined in `backend/config.py`:
```python
SCORE_WEIGHTS = {
    "provenance": 0.30,
    "content": 0.35,
    "context": 0.25,
    "source": 0.10
}
```

### Verdict Thresholds

```python
VERDICT_THRESHOLDS = {
    "verified": 75,
    "uncertain": 50
}
```

### Scoring Logic

1. Calculate individual scores for each module
2. Apply weighted formula
3. Add penalties for high-confidence issues:
   - Manipulation detected (≥80% confidence): -15
   - AI-generated (≥80% confidence): -10
   - Context mismatch (≥80% confidence): -10
4. Add bonus for valid C2PA: +10
5. Clamp to 0-100 range
6. Map to verdict:
   - ≥75: VERIFIED
   - ≥50: UNCERTAIN
   - <50: SUSPICIOUS

## Data Models

All Pydantic schemas are in `backend/models/schemas.py`:

- `VerdictType` - Enum: VERIFIED, UNCERTAIN, SUSPICIOUS
- `ProvenanceResult` - Provenance check results
- `ContentAnalysisResult` - Content analysis results
- `ContextResult` - Context verification results
- `SourceResult` - Source credibility results
- `TrustCard` - Final combined result
- `AnalysisResponse` - API response wrapper

## Configuration

All configuration is in `backend/config.py`:

- `GEMINI_API_KEY` - Required for AI analysis
- `GEMINI_MODEL` - Defaults to "gemini-2.5-flash"
- `MAX_FILE_SIZE_MB` - 50MB default
- `ALLOWED_EXTENSIONS` - image/video/audio/document types
- `UPLOAD_DIR` - Temp file storage (default: `backend/uploads`)
- `SCORE_WEIGHTS` - Analysis component weights
- `VERDICT_THRESHOLDS` - Score thresholds for verdicts

## Operational Notes

1. **No database** - Files are processed transiently; temp files are deleted after analysis
2. **No authentication** - CORS is wide open (`allow_origins=["*"]`)
3. **Synchronous processing** - All analysis runs in one request; no background jobs
4. **Error handling** - Most failures return 500 with error message
5. **Optional dependencies** - Some features require additional packages/API keys:
   - C2PA checks skipped if `c2pa-python` not installed
   - Domain age checks skipped if `python-whois` not installed
   - Fact checks skipped if `GOOGLE_FACTCHECK_API_KEY` not set

## File Structure

```
backend/
├── main.py              # FastAPI app, routes, request handling
├── config.py            # Configuration constants
├── requirements.txt     # Python dependencies
├── models/
│   └── schemas.py       # Pydantic models
├── services/
│   ├── __init__.py     # Service exports
│   ├── provenance.py   # C2PA + EXIF analysis
│   ├── content_analysis.py  # Manipulation/AI detection
│   ├── context_check.py # Caption/date/location verification
│   ├── source_check.py # URL/domain credibility
│   └── trust_card.py    # Final verdict generation
└── uploads/             # Temp file storage (runtime created)
```

## Running the Backend

```bash
cd backend
pip install -r requirements.txt
# Set GEMINI_API_KEY in .env or environment
python main.py
# Server runs on http://localhost:8000
```

## Known Limitations

- Reverse image search not implemented (placeholder)
- Deepfake detection is basic/placeholder
- No background job queue - large files may timeout
- No user authentication or rate limiting
