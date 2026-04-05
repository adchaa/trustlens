"""
Pydantic models for TrustLens API
"""
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from enum import Enum


class VerdictType(str, Enum):
    VERIFIED = "VERIFIED"
    UNCERTAIN = "UNCERTAIN"
    SUSPICIOUS = "SUSPICIOUS"


class AnalysisRequest(BaseModel):
    """Request for content analysis"""
    file_url: HttpUrl = Field(..., description="URL to the media file to analyze")
    caption: Optional[str] = Field(None, description="Caption or claim about the content")
    claimed_date: Optional[str] = Field(None, description="Claimed date of the content")
    claimed_location: Optional[str] = Field(None, description="Claimed location")
    source_url: Optional[str] = Field(None, description="URL source of the content")
    alt_text: Optional[str] = Field(None, description="Image description from a previous model")
    category: Optional[str] = Field(None, description="Category predicted by a previous model")
    confidence: Optional[int] = Field(None, ge=0, le=100, description="Confidence score from a previous model")


class ProvenanceResult(BaseModel):
    """Result from provenance check"""
    has_c2pa: bool = False
    has_exif: bool = False
    c2pa_valid: Optional[bool] = None
    active_manifest: Optional[str] = None
    camera: Optional[str] = None
    timestamp: Optional[str] = None
    gps: Optional[Dict[str, float]] = None
    software: Optional[str] = None
    suspicious_signs: List[str] = []
    provenance_score: int = 0
    explanation: str = ""


class ContentAnalysisResult(BaseModel):
    """Result from AI content analysis"""
    manipulation_detected: bool = False
    ai_generated: bool = False
    confidence: int = 50
    face_detected: bool = False
    deepfake_confidence: int = 0
    deepfake_indicators: List[str] = []
    manipulation_signs: List[str] = []
    ai_generation_signs: List[str] = []
    ela_suspicious: bool = False
    ela_stats: Optional[Dict[str, float]] = None
    explanation: str = ""


class ContextResult(BaseModel):
    """Result from context verification"""
    context_match: bool = True
    confidence: int = 50
    caption_matches_content: bool = True
    date_appears_consistent: Optional[bool] = None
    location_appears_consistent: Optional[bool] = None
    detected_elements: List[str] = []
    inconsistencies: List[str] = []
    reverse_search_matches: List[str] = []
    explanation: str = ""


class SourceResult(BaseModel):
    """Result from source credibility check"""
    domain: Optional[str] = None
    domain_age_days: Optional[int] = None
    has_ssl: bool = False
    suspicious_patterns: List[str] = []
    fact_checks_found: List[Dict[str, Any]] = []
    credibility_score: int = 50
    explanation: str = ""


class TrustCard(BaseModel):
    """Final trust verdict card"""
    verdict: VerdictType
    verdict_color: str
    confidence: int
    summary_bullets: List[str]
    detailed_scores: Dict[str, int]
    provenance: ProvenanceResult
    content_analysis: ContentAnalysisResult
    context: ContextResult
    source: Optional[SourceResult] = None


class AnalysisResponse(BaseModel):
    """Full analysis response"""
    success: bool
    file_name: str
    file_type: str
    trust_card: TrustCard
    processing_time_ms: int
