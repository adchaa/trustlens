# TrustLens Backend Architecture

## Overview

TrustLens is a content authenticity verification service built with FastAPI. The backend accepts a JSON request containing a `file_url`, downloads the media on the server, runs multiple analysis modules, and returns a trust verdict with detailed scores.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | FastAPI + Uvicorn |
| AI/ML | Google Gemini (gemini-2.5-flash) |
| Image Processing | PIL, numpy, exifread, OpenCV |
| Content Credentials | c2pa-python |
| Networking / Source Verification | httpx, python-whois, requests |
| Validation | Pydantic |

See `backend/requirements.txt` for the full dependency list.

## Request Flow

```
Frontend                         Backend                                Analysis Services
   |                                |                                            |
   |-- POST /analyze -------------->|                                            |
   |   {                            |                                            |
   |     file_url,                  |                                            |
   |     caption,                   |                                            |
   |     claimed_date,              |                                            |
   |     claimed_location,          |                                            |
   |     source_url,                |                                            |
   |     alt_text,                  |                                            |
   |     category,                  |                                            |
   |     confidence                 |                                            |
   |   }                            |                                            |
   |                                |-- validate_file_url()                     |
   |                                |   - extract filename from URL path        |
   |                                |   - map extension to file category        |
   |                                |   - reject unsupported file types         |
   |                                |                                            |
   |                                |-- download_file()                         |
   |                                |   - fetch bytes with httpx                |
   |                                |   - follow redirects                      |
   |                                |   - enforce 30 second timeout             |
   |                                |                                            |
   |                                |-- check size / save temp file             |
   |                                |   - reject files over MAX_FILE_SIZE_MB    |
   |                                |   - write backend/uploads/<uuid>.<ext>    |
   |                                |                                            |
   |                                |------> check_provenance()                 |
   |                                |      C2PA + EXIF + metadata heuristics    |
   |                                |                                            |
   |                                |------> analyze_content()                  |
   |                                |      ELA + Gemini + face heuristics       |
   |                                |                                            |
   |                                |------> verify_context()                   |
   |                                |      Gemini + optional reverse search     |
   |                                |                                            |
   |                                |------> check_source() if source_url       |
   |                                |      WHOIS + SSL + URL patterns + facts   |
   |                                |                                            |
   |                                |------> generate_trust_card()              |
   |                                |      weighted score + verdict             |
   |                                |                                            |
   |                                |-- delete temp file in finally             |
   |<-- AnalysisResponse -----------|                                            |
```

## API Endpoints

### POST /analyze

Full analysis endpoint accepting a JSON body described by `AnalysisRequest`.

**Request:**
```json
{
  "file_url": "https://example.com/image.jpg",
  "caption": "optional claim or caption",
  "claimed_date": "optional claimed date",
  "claimed_location": "optional claimed location",
  "source_url": "https://example.com/article",
  "alt_text": "optional prior model description",
  "category": "optional prior model category",
  "confidence": 87
}
```

`file_url` is required and is validated as an HTTP URL by Pydantic. All other fields are optional supporting signals.

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

### GET /health

Health check verifying:
- Upload directory exists
- GEMINI_API_KEY is configured

### GET /

Basic service metadata endpoint.

## Detailed `/analyze` Execution

This is the exact high-level flow implemented in `backend/main.py`.

### 1. Request validation

- FastAPI parses the body into `AnalysisRequest` from `backend/models/schemas.py`.
- `file_url` must be a valid `HttpUrl`.
- Optional fields provide extra context to later analysis steps:
  - `caption`, `claimed_date`, `claimed_location` feed context verification.
  - `source_url` enables source credibility checks.
  - `alt_text`, `category`, and `confidence` are passed into Gemini as prior model signals.

### 2. URL and extension validation

- `validate_file_url()` extracts the filename from the URL path.
- The backend maps the file extension into one of the configured categories: `image`, `video`, `audio`, or `document`.
- If the extension is not in `ALLOWED_EXTENSIONS`, the request fails with `400 Bad Request` before any download or analysis happens.

### 3. Server-side download

- `download_file()` uses `httpx.AsyncClient`.
- Redirects are allowed.
- The download timeout is 30 seconds.
- HTTP errors, network errors, and timeouts are converted into `400` responses because the backend could not retrieve the user-supplied file.

### 4. File size guard and temporary storage

- After download, the backend checks the byte length against `MAX_FILE_SIZE_MB`.
- Oversized files are rejected with `400 Bad Request`.
- The file is then written to `backend/uploads/<uuid>.<ext>`.
- This temp file is the shared input for all downstream services.

### 5. MIME type resolution

- `get_mime_type()` uses Python's `mimetypes` module to infer a MIME type from the filename.
- That MIME type is used mainly when sending the file to Gemini.

### 6. Provenance analysis

`check_provenance()` always runs, regardless of media category.

Inside `backend/services/provenance.py`, the service does four things:

1. `check_c2pa()` tries to read Content Credentials using `c2pa.Reader`.
2. `extract_exif()` reads image metadata with PIL and `exifread`.
3. `detect_suspicious_signs()` looks for stripped metadata, editing software, invalid timestamps, and C2PA validation problems.
4. `calculate_provenance_score()` converts those signals into a `0-100` score.

Current provenance scoring logic:

- Starts at `50`.
- Valid C2PA adds `45`.
- C2PA present but invalid still adds `20`.
- EXIF presence adds `10`.
- Camera make/model adds `5`.
- GPS adds `5`.
- Each suspicious sign subtracts `10`.

The returned `ProvenanceResult` contains structured metadata such as `active_manifest`, `camera`, `timestamp`, `gps`, `software`, `suspicious_signs`, and a human-readable `explanation`.

### 7. Content analysis

`analyze_content()` runs only when the file category is `image` or `video`.

If the file is `audio` or `document`, the backend returns a neutral `ContentAnalysisResult` with the explanation `Content analysis not available for this file type`.

Inside `backend/services/content_analysis.py`, the content pipeline combines three signals:

1. **Error Level Analysis (ELA)**
   - The service re-saves the file as JPEG at `ELA_QUALITY` and compares it to the original.
   - It computes `mean`, `std`, and `max` error statistics.
   - ELA is marked suspicious when `std_error > 25` or `max_error > 180`.

2. **Gemini forensic review**
   - The file bytes are sent to Gemini with a strict JSON-only prompt.
   - Gemini is asked to look for manipulation clues and AI-generation artifacts.
    - Prior model outputs (`alt_text`, `category`, `confidence`) are included as supporting evidence only, not as ground truth.

3. **Face-based deepfake heuristics**
   - This step runs only for image MIME types.
   - OpenCV detects up to three faces and checks blur, texture variance, and unusually uniform symmetry.
   - If OpenCV is missing or no face is found, the request still succeeds and the explanation notes the skipped heuristic.

How the content service merges results:

- `manipulation_detected` becomes `true` if Gemini reports manipulation or ELA is suspicious.
- `ai_generated` becomes `true` if Gemini reports AI generation, or if face heuristics produce enough deepfake evidence.
- `confidence` starts from Gemini's value, then is adjusted based on ELA and deepfake signals.
- The final explanation concatenates Gemini output, ELA notes, face-heuristic notes, and any prior model summary.

Note: the service is called for videos too, but its local heuristics are primarily image-oriented. Unsupported local checks fail soft and are folded into the explanation instead of aborting the request.

### 8. Context verification

`verify_context()` always runs.

Behavior depends on whether the request provided any claims:

- If `caption`, `claimed_date`, `claimed_location`, and `alt_text` are all missing, the backend returns a neutral `ContextResult` with `context_match=True` and `confidence=50`.
- Otherwise, it runs Gemini-based context verification and then an optional reverse image search.

Inside `backend/services/context_check.py`:

1. `verify_context_with_gemini()` checks whether the visible content matches the supplied caption, date, location, and prior alt text.
2. `check_reverse_image_matches()` optionally calls Google Vision `WEB_DETECTION`.

What Gemini checks:

- Whether the caption or description matches what is visible.
- Whether visible time clues fit the claimed date.
- Whether architecture, text, vegetation, or landmarks fit the claimed location.
- Whether the image looks like a reused or repurposed older image.

Reverse image search rules:

- It runs only for images.
- It runs only if `GOOGLE_CLOUD_API_KEY` is configured.
- It returns up to `REVERSE_IMAGE_MAX_RESULTS` best-guess labels or matching URLs.
- If it cannot run, the reason is appended to the explanation instead of failing the request.

### 9. Source credibility analysis

`check_source()` runs only when `source_url` is present.

Inside `backend/services/source_check.py`, it performs four checks:

1. Domain parsing and normalization.
   - The backend extracts the host and strips a leading `www.`.
2. WHOIS age lookup.
   - If `python-whois` is not installed, domain age is skipped.
3. SSL validation.
   - The backend opens a socket to port `443` and inspects the certificate.
4. Suspicious URL pattern detection.
   - Regex heuristics flag typosquatting, long numeric strings, free TLDs, excessive subdomains, IP-address hosts, and similar patterns.

If a claim/caption exists and `GOOGLE_FACTCHECK_API_KEY` is configured, the service also queries Google Fact Check Tools and stores the returned reviews in `fact_checks_found`.

Current source scoring logic:

- Starts at `50`.
- Reputable domains can add `30`.
- Very new domains lose up to `25`.
- Older domains gain up to `15`.
- Valid SSL adds `10`.
- Missing SSL subtracts `10`.
- Each suspicious pattern subtracts `10`.

### 10. Trust card generation

`generate_trust_card()` combines all module outputs into the API result returned to the frontend.

Per-module scores:

- `provenance`: direct from `provenance.provenance_score`
- `content`: computed from content flags and confidence
- `context`: computed from `context_match` and context confidence
- `source`: `source.credibility_score`, or `50` if no source analysis ran

Weighted score calculation:

```python
SCORE_WEIGHTS = {
    "provenance": 0.30,
    "content": 0.35,
    "context": 0.25,
    "source": 0.10
}
```

Extra trust-card adjustments after weighting:

- `-15` for high-confidence manipulation (`confidence >= 80`)
- `-10` for high-confidence AI generation
- `-10` for high-confidence context mismatch
- `-5` when reverse image matches exist and context already looks wrong
- `+10` for valid C2PA credentials

The final score is clamped to `0-100` and mapped to:

- `VERIFIED` for `>= 75`
- `UNCERTAIN` for `>= 50`
- `SUSPICIOUS` for `< 50`

The trust card also includes up to four `summary_bullets`, a `verdict_color`, and the raw nested module outputs.

### 11. Cleanup and response

- The temp file is deleted in a `finally` block, even when analysis fails.
- Success responses return `AnalysisResponse` with `success`, `file_name`, `file_type`, `trust_card`, and `processing_time_ms`.
- Errors raised before the analysis block, such as unsupported file type, download failure, or oversize file, return `400`.
- Exceptions during the pipeline are wrapped as `500` with `Analysis failed: ...`.

## Analysis Modules

### 1. Provenance (`backend/services/provenance.py`)

Checks for origin metadata and provenance signals in the downloaded media file.

**What it does:**
- Extracts C2PA (Content Credentials) if present
- Extracts EXIF metadata with PIL and `exifread` (camera, timestamp, GPS, software)
- Detects suspicious patterns such as stripped metadata, editing software, invalid timestamps, and C2PA validation failures
- Converts those signals into a `provenance_score`

**Returns:** `ProvenanceResult`
- `has_c2pa`: bool
- `has_exif`: bool
- `c2pa_valid`: bool | None
- `active_manifest`: str | None
- `camera`: str | None
- `timestamp`: str | None
- `gps`: dict | None
- `software`: str | None
- `suspicious_signs`: list
- `provenance_score`: int (0-100)
- `explanation`: str

### 2. Content Analysis (`backend/services/content_analysis.py`)

Detects manipulation, AI-generation signals, and lightweight deepfake indicators.

**Techniques:**
- **Error Level Analysis (ELA):** Re-saves JPEG and compares compression differences. High variance in error levels suggests manipulation.
- **Gemini Vision:** Sends file bytes to Gemini with a forensic prompt asking for manipulation and AI-generation signs.
- **Face heuristics:** Uses OpenCV to look for unusually smooth, low-texture, or overly symmetric face regions that can be associated with synthetic imagery.

For audio and document inputs, this module is skipped and the backend returns a neutral explanation instead.

**Returns:** `ContentAnalysisResult`
- `manipulation_detected`: bool
- `ai_generated`: bool
- `confidence`: int (0-100)
- `face_detected`: bool
- `deepfake_confidence`: int (0-100)
- `deepfake_indicators`: list
- `manipulation_signs`: list
- `ai_generation_signs`: list
- `ela_suspicious`: bool
- `ela_stats`: dict | None
- `explanation`: str

### 3. Context Verification (`backend/services/context_check.py`)

Verifies whether the visible content matches user-provided claims and whether the image appears to have prior web reuse.

**What it checks:**
- Does the caption match the image content?
- Does the claimed date match visual clues (technology, fashion, signage)?
- Does the claimed location match visual evidence?
- If the upload is an image and Google Vision is configured, are there web matches suggesting reuse or repurposing?

**Returns:** `ContextResult`
- `context_match`: bool
- `confidence`: int (0-100)
- `caption_matches_content`: bool
- `date_appears_consistent`: bool | None
- `location_appears_consistent`: bool | None
- `detected_elements`: list
- `inconsistencies`: list
- `reverse_search_matches`: list
- `explanation`: str

Reverse image search uses Google Vision `WEB_DETECTION` when `GOOGLE_CLOUD_API_KEY` is configured. If the key is missing or the upload is not an image, the backend returns no matches and notes that in the explanation.

### 4. Source Credibility (`backend/services/source_check.py`)

Evaluates trustworthiness of a provided source URL and optionally checks the textual claim against fact-check APIs.

**What it checks:**
- Domain age via WHOIS
- SSL certificate validity
- Suspicious URL patterns (typosquatting, free TLDs, excessive subdomains)
- Google Fact Check Tools API for claim verification when a caption/claim is available

**Returns:** `SourceResult`
- `domain`: str | None
- `domain_age_days`: int | None
- `has_ssl`: bool
- `suspicious_patterns`: list
- `fact_checks_found`: list
- `credibility_score`: int (0-100)
- `explanation`: str

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
4. Add a small penalty when reverse image search finds matches and context already looks inconsistent
5. Add bonus for valid C2PA: +10
6. Clamp to 0-100 range
7. Map to verdict:
   - ≥75: VERIFIED
   - ≥50: UNCERTAIN
   - <50: SUSPICIOUS

## Data Models

All Pydantic schemas are in `backend/models/schemas.py`:

- `AnalysisRequest` - Input body for `/analyze`
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
- `GOOGLE_CLOUD_API_KEY` - Optional, enables reverse image search via Vision API
- `GEMINI_MODEL` - Defaults to "gemini-2.5-flash"
- `MAX_FILE_SIZE_MB` - 50MB default
- `ALLOWED_EXTENSIONS` - image/video/audio/document types
- `UPLOAD_DIR` - Temp file storage (default: `backend/uploads`)
- `SCORE_WEIGHTS` - Analysis component weights
- `VERDICT_THRESHOLDS` - Score thresholds for verdicts

## Operational Notes

1. **No database** - Downloaded files are processed transiently; temp files are deleted after analysis
2. **No authentication** - CORS is wide open (`allow_origins=["*"]`)
3. **Synchronous processing** - All analysis runs in one request; no background jobs
4. **URL-based ingestion** - The backend fetches `file_url` itself; the client does not upload multipart file bytes directly
5. **Error handling** - Validation, download, and size failures return `400`; most in-pipeline failures return `500` with an error message
6. **Optional dependencies** - Some features require additional packages/API keys:
   - Deepfake face heuristics are skipped if OpenCV is not installed
   - Domain age checks are skipped if `python-whois` is not installed
   - Reverse image search is skipped if `GOOGLE_CLOUD_API_KEY` is not set
   - Fact checks are skipped if `GOOGLE_FACTCHECK_API_KEY` is not set

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

- Reverse image search depends on Google Vision API and is unavailable without `GOOGLE_CLOUD_API_KEY`
- Deepfake detection uses lightweight OpenCV face heuristics rather than a dedicated forensic model
- Audio and document inputs do not run the full content-analysis pipeline
- No background job queue - large files may timeout
- No user authentication or rate limiting
