"""
Context Verification Service
Checks if content matches claimed context (caption, date, location)
"""
import base64
import json
from importlib import import_module
from pathlib import Path
from typing import Dict, Any, Optional, List

genai = import_module("google.generativeai")
import requests

from config import GEMINI_API_KEY, GEMINI_MODEL, GOOGLE_CLOUD_API_KEY, REVERSE_IMAGE_MAX_RESULTS
from models.schemas import ContextResult

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)


def verify_context_with_gemini(
    file_path: str,
    caption: Optional[str] = None,
    claimed_date: Optional[str] = None,
    claimed_location: Optional[str] = None,
    alt_text: Optional[str] = None,
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
    
    if not caption and not alt_text and not claimed_date and not claimed_location:
        result["explanation"] = "No context provided for context verification"
        return result
    
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        file_data = Path(file_path).read_bytes()
        
        # Build context info
        context_parts = []
        if caption:
            context_parts.append(f'Caption/Claim: "{caption}"')
        if alt_text:
            context_parts.append(f'Previous Model Alt Text: "{alt_text}"')
        if claimed_date:
            context_parts.append(f"Claimed Date: {claimed_date}")
        if claimed_location:
            context_parts.append(f"Claimed Location: {claimed_location}")
        
        context_info = "\n".join(context_parts)
        
        prompt = f"""You are a fact-checker verifying if this image matches the claims made about it.

CLAIMED INFORMATION:
{context_info}

ANALYZE CAREFULLY:

1. CAPTION/DESCRIPTION VERIFICATION:
   - Does the image actually show what the caption or previous-model alt text describes?
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

Treat any previous-model alt text as supporting context, not ground truth. If only date/location is provided, assess those clues based on the visible content.

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
}}

For "caption_matches_content", return true when any supplied caption or alt text matches the image, and return true if neither caption nor alt text was provided."""
        
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


def check_reverse_image_matches(file_path: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Check for likely reverse image matches using Google Vision web detection.
    """
    result = {
        "matches": [],
        "performed": False,
        "explanation": ""
    }

    if not mime_type.startswith("image/"):
        result["explanation"] = "Reverse image search is only available for images"
        return result

    if not GOOGLE_CLOUD_API_KEY:
        result["explanation"] = "Reverse image search unavailable: GOOGLE_CLOUD_API_KEY not configured"
        return result

    try:
        file_data = Path(file_path).read_bytes()
        response = requests.post(
            f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_CLOUD_API_KEY}",
            json={
                "requests": [
                    {
                        "image": {"content": base64.b64encode(file_data).decode("utf-8")},
                        "features": [{"type": "WEB_DETECTION", "maxResults": REVERSE_IMAGE_MAX_RESULTS}]
                    }
                ]
            },
            timeout=30
        )
        response.raise_for_status()
        payload = response.json()
        web_detection = payload.get("responses", [{}])[0].get("webDetection", {})

        matches = []
        for label in web_detection.get("bestGuessLabels", []):
            text = label.get("label")
            if text:
                matches.append(f"Best guess: {text}")

        for page in web_detection.get("pagesWithMatchingImages", []):
            url = page.get("url")
            if url and url not in matches:
                matches.append(url)

        for image in web_detection.get("fullMatchingImages", []):
            url = image.get("url")
            if url and url not in matches:
                matches.append(url)

        result["matches"] = matches[:REVERSE_IMAGE_MAX_RESULTS]
        result["performed"] = True
        result["explanation"] = (
            "Found visually similar web references"
            if result["matches"]
            else "No strong public web matches found"
        )
    except Exception as e:
        result["explanation"] = f"Reverse image search failed: {str(e)}"

    return result


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
    alt_text: Optional[str] = None,
    mime_type: str = "image/jpeg"
) -> ContextResult:
    """
    Main function to verify content context.
    
    Args:
        file_path: Path to the media file
        caption: Caption or claim about the content
        claimed_date: Claimed date of the content
        claimed_location: Claimed location
        alt_text: Image description from a previous model
        mime_type: MIME type of the file
        
    Returns:
        ContextResult with verification information
    """
    # If no context provided, return neutral result
    if not caption and not claimed_date and not claimed_location and not alt_text:
        return ContextResult(
            context_match=True,
            confidence=50,
            explanation="No context claims provided for verification"
        )
    
    # Run Gemini context verification
    gemini_result = verify_context_with_gemini(
        file_path=file_path,
        caption=caption,
        claimed_date=claimed_date,
        claimed_location=claimed_location,
        alt_text=alt_text,
        mime_type=mime_type
    )
    
    reverse_search = check_reverse_image_matches(file_path, mime_type)
    reverse_matches = reverse_search.get("matches", [])

    explanation = gemini_result.get("explanation", "Context verification complete")
    reverse_explanation = reverse_search.get("explanation")
    if reverse_explanation:
        explanation = f"{explanation} | Reverse search: {reverse_explanation}"
    
    return ContextResult(
        context_match=gemini_result.get("context_match", True),
        confidence=gemini_result.get("confidence", 50),
        caption_matches_content=gemini_result.get("caption_matches_content", True),
        date_appears_consistent=gemini_result.get("date_appears_consistent"),
        location_appears_consistent=gemini_result.get("location_appears_consistent"),
        detected_elements=gemini_result.get("detected_elements", []),
        inconsistencies=gemini_result.get("inconsistencies", []),
        reverse_search_matches=reverse_matches,
        explanation=explanation
    )
