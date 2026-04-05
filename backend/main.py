"""
TrustLens API - Main FastAPI Application
Content authenticity verification service
"""
import os
import sys
import time
import uuid
import mimetypes
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, unquote

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from config import UPLOAD_DIR, MAX_FILE_SIZE_MB, ALLOWED_EXTENSIONS
from models.schemas import AnalysisRequest, AnalysisResponse, TrustCard
from services import (
    check_provenance,
    analyze_content,
    verify_context,
    check_source,
    generate_trust_card
)

# Create FastAPI app
app = FastAPI(
    title="TrustLens API",
    description="Content authenticity verification service - detect manipulation, AI-generated content, and misinformation",
    version="1.0.0"
)

# Download timeout in seconds
DOWNLOAD_TIMEOUT = 30

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_mime_type(filename: str) -> str:
    """Get MIME type from filename."""
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


def validate_file_url(url: str) -> tuple[str, str]:
    """
    Validate file URL and return (filename, file_type_category).
    Extracts filename from URL path.
    """
    parsed = urlparse(str(url))
    path = unquote(parsed.path)
    filename = Path(path).name
    
    if not filename:
        # Try to generate a filename if URL has no path
        filename = "downloaded_file"
    
    ext = Path(filename).suffix.lower()
    
    # Check if extension is supported
    for category, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return filename, category
    
    # If no valid extension found, try to infer from URL or default to image
    # This handles URLs like "https://example.com/image?id=123" without extension
    if not ext or ext not in [e for exts in ALLOWED_EXTENSIONS.values() for e in exts]:
        # Default to image category - we'll verify content-type after download
        return filename if ext else f"{filename}.jpg", "image"


async def download_file(url: str) -> tuple[bytes, str | None]:
    """Download file from URL with timeout. Returns (content, content_type)."""
    try:
        async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
            response = await client.get(str(url))
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").split(";")[0].strip()
            return response.content, content_type
    except httpx.TimeoutException:
        raise HTTPException(400, f"Download timed out after {DOWNLOAD_TIMEOUT} seconds")
    except httpx.HTTPStatusError as e:
        raise HTTPException(400, f"Failed to download file: HTTP {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(400, f"Failed to download file: {str(e)}")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "TrustLens API",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "analyze": "POST /analyze - Analyze content from URL",
            "health": "GET /health - Health check"
        }
    }


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "checks": {
            "upload_dir": UPLOAD_DIR.exists(),
            "gemini_configured": bool(os.getenv("GEMINI_API_KEY"))
        }
    }


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_content_endpoint(request: AnalysisRequest):
    """
    Analyze content from URL for authenticity.
    
    This endpoint performs comprehensive analysis including:
    - Provenance check (C2PA, EXIF metadata)
    - Content analysis (manipulation detection, AI generation)
    - Context verification (caption vs content matching)
    - Source credibility (if URL provided)
    
    Returns a TrustCard with verdict, confidence score, and detailed analysis.
    """
    print(request)
    start_time = time.time()
    
    # Validate file URL and get filename/type
    filename, file_type = validate_file_url(str(request.file_url))
    
    # Download file from URL
    content, content_type = await download_file(str(request.file_url))
    
    # Infer file type from content-type header if we defaulted earlier
    if content_type:
        if content_type.startswith("image/"):
            file_type = "image"
        elif content_type.startswith("video/"):
            file_type = "video"
        elif content_type.startswith("audio/"):
            file_type = "audio"
        elif content_type == "application/pdf":
            file_type = "document"
    
    # Check file size
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB")
    
    # Save file temporarily
    file_id = str(uuid.uuid4())
    file_ext = Path(filename).suffix
    temp_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    try:
        # Write file
        temp_path.write_bytes(content)
        
        # Use content-type from response if available, otherwise guess from filename
        mime_type = content_type if content_type else get_mime_type(filename)
        
        # Run analysis pipeline
        # 1. Provenance check
        provenance_result = check_provenance(str(temp_path))
        
        # 2. Content analysis (only for images/videos for now)
        if file_type in ["image", "video"]:
            content_result = analyze_content(
                str(temp_path),
                mime_type,
                alt_text=request.alt_text,
                potential_category=request.category,
                model_confidence=request.confidence,
            )
        else:
            from models.schemas import ContentAnalysisResult
            content_result = ContentAnalysisResult(
                explanation="Content analysis not available for this file type"
            )
        
        # 3. Context verification
        context_result = verify_context(
            file_path=str(temp_path),
            caption=request.caption,
            claimed_date=request.claimed_date,
            claimed_location=request.claimed_location,
            alt_text=request.alt_text,
            mime_type=mime_type
        )
        
        # 4. Source credibility (if URL provided)
        source_result = None
        if request.source_url:
            source_result = check_source(url=request.source_url, claim=request.caption)
        
        # 5. Generate trust card
        trust_card = generate_trust_card(
            provenance=provenance_result,
            content=content_result,
            context=context_result,
            source=source_result
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return AnalysisResponse(
            success=True,
            file_name=filename,
            file_type=file_type,
            trust_card=trust_card,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")
    
    finally:
        # Cleanup temp file
        if temp_path.exists():
            temp_path.unlink()


if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*50)
    print("TrustLens API Starting...")
    print("="*50)
    print(f"Upload directory: {UPLOAD_DIR}")
    print(f"Max file size: {MAX_FILE_SIZE_MB}MB")
    print("="*50 + "\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
