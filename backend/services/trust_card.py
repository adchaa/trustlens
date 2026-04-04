"""
Trust Card Generator
Combines all analysis results into a final verdict
"""
from typing import Optional
from config import SCORE_WEIGHTS, VERDICT_THRESHOLDS
from models.schemas import (
    ProvenanceResult,
    ContentAnalysisResult,
    ContextResult,
    SourceResult,
    TrustCard,
    VerdictType
)


def calculate_content_score(content_result: ContentAnalysisResult) -> int:
    """Calculate score from content analysis (0-100)."""
    score = 100
    
    if content_result.manipulation_detected:
        score -= 40
    
    if content_result.ai_generated:
        score -= 30
    
    if content_result.ela_suspicious:
        score -= 15
    
    # Adjust by confidence
    confidence_factor = content_result.confidence / 100
    
    # If confident about no issues, boost score
    if not content_result.manipulation_detected and not content_result.ai_generated:
        score = min(100, score + int(20 * confidence_factor))
    
    return max(0, min(100, score))


def calculate_context_score(context_result: ContextResult) -> int:
    """Calculate score from context verification (0-100)."""
    if context_result.context_match:
        # Base on confidence
        return min(100, 50 + context_result.confidence // 2)
    else:
        # Context mismatch
        return max(0, 50 - (100 - context_result.confidence) // 2)


def generate_summary_bullets(
    provenance: ProvenanceResult,
    content: ContentAnalysisResult,
    context: ContextResult,
    source: Optional[SourceResult]
) -> list:
    """Generate concise summary bullets for the trust card."""
    bullets = []
    
    # Provenance bullets
    if provenance.has_c2pa:
        if provenance.c2pa_valid:
            bullets.append("Valid Content Credentials (C2PA) found")
        else:
            bullets.append("Content Credentials found but have issues")
    elif provenance.has_exif:
        if provenance.camera:
            bullets.append(f"Captured with {provenance.camera}")
        else:
            bullets.append("Original camera metadata present")
    
    # Content analysis bullets
    if content.manipulation_detected:
        bullets.append("Signs of manipulation detected")
    elif content.confidence >= 70:
        bullets.append("No manipulation detected")
    
    if content.ai_generated:
        bullets.append("Content appears AI-generated")
    
    # Context bullets
    if context.context_match and context.confidence >= 70:
        bullets.append("Context matches claimed content")
    elif not context.context_match:
        bullets.append("Context inconsistencies found")
    
    # Suspicious signs
    if provenance.suspicious_signs:
        bullets.append(provenance.suspicious_signs[0])
    
    # Source bullets
    if source and source.fact_checks_found:
        verdict = source.fact_checks_found[0].get("rating", "")
        if verdict:
            bullets.append(f"Fact check: {verdict}")
    
    # Limit to 4 bullets
    return bullets[:4]


def generate_trust_card(
    provenance: ProvenanceResult,
    content: ContentAnalysisResult,
    context: ContextResult,
    source: Optional[SourceResult] = None
) -> TrustCard:
    """
    Generate the final trust verdict card.
    
    Combines results from all analysis modules into a single
    weighted score and verdict.
    
    Args:
        provenance: Result from provenance check
        content: Result from content analysis
        context: Result from context verification
        source: Result from source credibility check (optional)
        
    Returns:
        TrustCard with final verdict and all details
    """
    # Calculate individual scores
    scores = {
        "provenance": provenance.provenance_score,
        "content": calculate_content_score(content),
        "context": calculate_context_score(context),
        "source": source.credibility_score if source else 50
    }
    
    # Calculate weighted final score
    final_score = sum(
        scores[key] * SCORE_WEIGHTS[key] 
        for key in SCORE_WEIGHTS
    )
    
    # Apply penalties for critical issues
    if content.manipulation_detected and content.confidence >= 80:
        final_score -= 15  # High confidence manipulation
    
    if content.ai_generated and content.confidence >= 80:
        final_score -= 10  # High confidence AI generation
    
    if not context.context_match and context.confidence >= 80:
        final_score -= 10  # High confidence context mismatch
    
    # Bonus for strong provenance
    if provenance.has_c2pa and provenance.c2pa_valid:
        final_score += 10  # Verified provenance bonus
    
    # Clamp score
    final_score = max(0, min(100, final_score))
    
    # Determine verdict
    if final_score >= VERDICT_THRESHOLDS["verified"]:
        verdict = VerdictType.VERIFIED
        verdict_color = "green"
    elif final_score >= VERDICT_THRESHOLDS["uncertain"]:
        verdict = VerdictType.UNCERTAIN
        verdict_color = "yellow"
    else:
        verdict = VerdictType.SUSPICIOUS
        verdict_color = "red"
    
    # Generate summary bullets
    summary_bullets = generate_summary_bullets(provenance, content, context, source)
    
    return TrustCard(
        verdict=verdict,
        verdict_color=verdict_color,
        confidence=int(final_score),
        summary_bullets=summary_bullets,
        detailed_scores=scores,
        provenance=provenance,
        content_analysis=content,
        context=context,
        source=source
    )
