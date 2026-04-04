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

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
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


def validate_file(file: UploadFile) -> str:
    """Validate uploaded file and return file type category."""
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    
    ext = Path(file.filename).suffix.lower()
    
    for category, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return category
    
    raise HTTPException(
        400, 
        f"Unsupported file type: {ext}. Supported: {list(ALLOWED_EXTENSIONS.keys())}"
    )


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "TrustLens API",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "analyze": "POST /analyze - Analyze uploaded content",
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
async def analyze_content_endpoint(
    file: UploadFile = File(..., description="Media file to analyze"),
    caption: Optional[str] = Form(None, description="Caption or claim about the content"),
    claimed_date: Optional[str] = Form(None, description="Claimed date of content"),
    claimed_location: Optional[str] = Form(None, description="Claimed location"),
    source_url: Optional[str] = Form(None, description="Source URL")
):
    """
    Analyze uploaded content for authenticity.
    
    This endpoint performs comprehensive analysis including:
    - Provenance check (C2PA, EXIF metadata)
    - Content analysis (manipulation detection, AI generation)
    - Context verification (caption vs content matching)
    - Source credibility (if URL provided)
    
    Returns a TrustCard with verdict, confidence score, and detailed analysis.
    """
    start_time = time.time()
    
    # Validate file
    file_type = validate_file(file)
    
    # Check file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB")
    
    # Save file temporarily
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    temp_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    try:
        # Write file
        temp_path.write_bytes(content)
        
        mime_type = get_mime_type(file.filename)
        
        # Run analysis pipeline
        # 1. Provenance check
        provenance_result = check_provenance(str(temp_path))
        
        # 2. Content analysis (only for images/videos for now)
        if file_type in ["image", "video"]:
            content_result = analyze_content(str(temp_path), mime_type)
        else:
            from models.schemas import ContentAnalysisResult
            content_result = ContentAnalysisResult(
                explanation="Content analysis not available for this file type"
            )
        
        # 3. Context verification
        context_result = verify_context(
            file_path=str(temp_path),
            caption=caption,
            claimed_date=claimed_date,
            claimed_location=claimed_location,
            mime_type=mime_type
        )
        
        # 4. Source credibility (if URL provided)
        source_result = None
        if source_url:
            source_result = check_source(url=source_url, claim=caption)
        
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
            file_name=file.filename,
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


@app.post("/analyze/quick")
async def quick_analyze(
    file: UploadFile = File(...),
):
    """
    Quick analysis - only provenance and basic content check.
    Faster but less comprehensive than full analysis.
    """
    start_time = time.time()
    
    file_type = validate_file(file)
    content = await file.read()
    
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    temp_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    try:
        temp_path.write_bytes(content)
        
        # Only provenance check
        provenance_result = check_provenance(str(temp_path))
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "success": True,
            "file_name": file.filename,
            "quick_verdict": "VERIFIED" if provenance_result.provenance_score >= 75 else 
                            "UNCERTAIN" if provenance_result.provenance_score >= 50 else "SUSPICIOUS",
            "provenance_score": provenance_result.provenance_score,
            "has_c2pa": provenance_result.has_c2pa,
            "has_exif": provenance_result.has_exif,
            "explanation": provenance_result.explanation,
            "processing_time_ms": processing_time
        }
        
    finally:
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
