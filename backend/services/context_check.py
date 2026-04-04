"""
Context Verification Service
Checks if content matches claimed context (caption, date, location)
"""
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL
from models.schemas import ContextResult

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)


def verify_context_with_gemini(
    file_path: str,
    caption: str,
    claimed_date: Optional[str] = None,
    claimed_location: Optional[str] = None,
    mime_type: str = "image/jpeg"
) -> Dict[str, Any]:
    """
    Use Gemini to verify if content matches claimed context.
    """
    result = {
        "context_match": True,
        "confidence": 50,
        "caption_matches_content": True,
        "date_appears_consistent": None,
        "location_appears_consistent": None,
        "detected_elements": [],
        "inconsistencies": [],
        "explanation": ""
    }
    
    if not caption:
        result["explanation"] = "No caption provided for context verification"
        return result
    
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        file_data = Path(file_path).read_bytes()
        
        # Build context info
        context_parts = [f'Caption/Claim: "{caption}"']
        if claimed_date:
            context_parts.append(f"Claimed Date: {claimed_date}")
        if claimed_location:
            context_parts.append(f"Claimed Location: {claimed_location}")
        
        context_info = "\n".join(context_parts)
        
        prompt = f"""You are a fact-checker verifying if this image matches the claims made about it.

CLAIMED INFORMATION:
{context_info}

ANALYZE CAREFULLY:

1. CAPTION/CLAIM VERIFICATION:
   - Does the image actually show what the caption describes?
   - Are there contradictions between what you see and what is claimed?
   - Could this image be misrepresenting the actual event/subject?

2. TEMPORAL CLUES (if date is claimed):
   - Look for: technology (phones, cars, screens), fashion, hairstyles
   - Look for: signage, posters, seasonal indicators
   - Does the apparent time period match the claimed date?

3. LOCATION CLUES (if location is claimed):
   - Look for: architecture style, signs/text language, vegetation
   - Look for: vehicles (license plates), street layouts, landmarks
   - Does the visual evidence support the claimed location?

4. REUSE DETECTION:
   - Could this be an old/famous image being reused?
   - Are there watermarks or artifacts suggesting it's from elsewhere?

Be skeptical but fair. Many legitimate images may lack clear temporal/location markers.

Respond ONLY with valid JSON in this exact format:
{{
    "context_match": true or false,
    "confidence": 0-100,
    "caption_matches_content": true or false,
    "date_appears_consistent": true or false or null (if can't determine),
    "location_appears_consistent": true or false or null (if can't determine),
    "detected_elements": ["list key things you observe in the image"],
    "inconsistencies": ["list any mismatches between claims and content"],
    "explanation": "2-3 sentence summary explaining your assessment"
}}"""
        
        response = model.generate_content([
            {"mime_type": mime_type, "data": file_data},
            prompt
        ])
        
        # Parse response
        response_text = response.text.strip()
        
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        parsed = json.loads(response_text)
        
        result["context_match"] = parsed.get("context_match", True)
        result["confidence"] = parsed.get("confidence", 50)
        result["caption_matches_content"] = parsed.get("caption_matches_content", True)
        result["date_appears_consistent"] = parsed.get("date_appears_consistent")
        result["location_appears_consistent"] = parsed.get("location_appears_consistent")
        result["detected_elements"] = parsed.get("detected_elements", [])
        result["inconsistencies"] = parsed.get("inconsistencies", [])
        result["explanation"] = parsed.get("explanation", "Context verification complete")
        
    except json.JSONDecodeError:
        result["explanation"] = f"Analysis complete (response parsing issue)"
    except Exception as e:
        result["error"] = str(e)
        result["explanation"] = f"Context verification failed: {str(e)}"
    
    return result


def check_reverse_image_matches(file_path: str) -> List[str]:
    """
    Check for reverse image search matches.
    
    NOTE: This is a placeholder. In production, you would use:
    - Google Vision API (web_detection)
    - TinEye API
    - Custom embedding similarity search
    
    For the hackathon, you could:
    1. Use Google Vision API if you have credentials
    2. Manual check: show users how to do reverse image search
    """
    # Placeholder - would integrate with Google Vision API
    return []


def extract_visual_timestamp_clues(file_path: str) -> Dict[str, Any]:
    """
    Extract visual clues about when an image might have been taken.
    
    This is a simplified version - a full implementation would use
    object detection to identify datable items.
    """
    return {
        "visual_clues": [],
        "estimated_era": None,
        "confidence": 0
    }


def verify_context(
    file_path: str,
    caption: Optional[str] = None,
    claimed_date: Optional[str] = None,
    claimed_location: Optional[str] = None,
    mime_type: str = "image/jpeg"
) -> ContextResult:
    """
    Main function to verify content context.
    
    Args:
        file_path: Path to the media file
        caption: Caption or claim about the content
        claimed_date: Claimed date of the content
        claimed_location: Claimed location
        mime_type: MIME type of the file
        
    Returns:
        ContextResult with verification information
    """
    # If no context provided, return neutral result
    if not caption and not claimed_date and not claimed_location:
        return ContextResult(
            context_match=True,
            confidence=50,
            explanation="No context claims provided for verification"
        )
    
    # Run Gemini context verification
    gemini_result = verify_context_with_gemini(
        file_path=file_path,
        caption=caption or "",
        claimed_date=claimed_date,
        claimed_location=claimed_location,
        mime_type=mime_type
    )
    
    # Check for reverse image matches (placeholder)
    reverse_matches = check_reverse_image_matches(file_path)
    
    return ContextResult(
        context_match=gemini_result.get("context_match", True),
        confidence=gemini_result.get("confidence", 50),
        caption_matches_content=gemini_result.get("caption_matches_content", True),
        date_appears_consistent=gemini_result.get("date_appears_consistent"),
        location_appears_consistent=gemini_result.get("location_appears_consistent"),
        detected_elements=gemini_result.get("detected_elements", []),
        inconsistencies=gemini_result.get("inconsistencies", []),
        reverse_search_matches=reverse_matches,
        explanation=gemini_result.get("explanation", "Context verification complete")
    )
