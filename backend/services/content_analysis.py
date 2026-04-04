"""
Content Analysis Service - AI-powered manipulation detection
Uses Gemini API and local analysis techniques
"""
import json
import io
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
from PIL import Image, ImageChops

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL, ELA_QUALITY
from models.schemas import ContentAnalysisResult


# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)


def perform_ela(image_path: str, quality: int = ELA_QUALITY) -> Dict[str, Any]:
    """
    Perform Error Level Analysis (ELA) to detect JPEG manipulation.
    
    ELA works by resaving a JPEG at a known quality and comparing
    the differences. Manipulated areas often show different error levels.
    """
    result = {
        "performed": False,
        "mean_error": 0.0,
        "std_error": 0.0,
        "max_error": 0.0,
        "suspicious": False,
        "explanation": ""
    }
    
    try:
        # Load original image
        original = Image.open(image_path).convert('RGB')
        
        # Resave at specified quality
        buffer = io.BytesIO()
        original.save(buffer, 'JPEG', quality=quality)
        buffer.seek(0)
        resaved = Image.open(buffer).convert('RGB')
        
        # Calculate pixel-by-pixel difference
        ela = ImageChops.difference(original, resaved)
        
        # Convert to numpy for statistics
        ela_array = np.array(ela)
        
        # Calculate statistics
        result["mean_error"] = float(np.mean(ela_array))
        result["std_error"] = float(np.std(ela_array))
        result["max_error"] = float(np.max(ela_array))
        result["performed"] = True
        
        # Heuristic for suspicious manipulation
        # High standard deviation often indicates inconsistent compression
        if result["std_error"] > 25 or result["max_error"] > 180:
            result["suspicious"] = True
            result["explanation"] = "High error variance detected - possible manipulation"
        else:
            result["explanation"] = "Error levels appear consistent"
            
    except Exception as e:
        result["error"] = str(e)
        result["explanation"] = f"ELA failed: {str(e)}"
    
    return result


def analyze_with_gemini(file_path: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Use Gemini multimodal model to analyze content for manipulation/AI generation.
    """
    result = {
        "manipulation_detected": False,
        "ai_generated": False,
        "confidence": 50,
        "manipulation_signs": [],
        "ai_generation_signs": [],
        "explanation": ""
    }
    
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        # Read file
        file_data = Path(file_path).read_bytes()
        
        prompt = """You are an expert forensic analyst examining digital content for authenticity.

Analyze this image carefully for:

1. MANIPULATION SIGNS (editing, splicing, compositing):
   - Inconsistent lighting, shadows, or reflections
   - Unnatural edges, halos, or blending artifacts
   - Clone stamp or copy-paste artifacts
   - Warping, stretching, or perspective issues
   - Color/exposure inconsistencies between regions
   - Mismatched noise patterns or compression artifacts

2. AI GENERATION SIGNS (DALL-E, Midjourney, Stable Diffusion, etc.):
   - Unnatural skin texture (too smooth or waxy)
   - Deformed or extra fingers, hands, limbs
   - Asymmetric or distorted facial features
   - Text or writing that looks wrong
   - Inconsistent background details
   - Unrealistic reflections in eyes or glasses
   - Repeating patterns or impossible geometry

3. OVERALL ASSESSMENT:
   - Does this appear to be an authentic photograph?
   - What is your confidence level (0-100)?

IMPORTANT: Be thorough but avoid false positives. Many authentic photos have minor imperfections.

Respond ONLY with valid JSON in this exact format:
{
    "manipulation_detected": true or false,
    "ai_generated": true or false,
    "confidence": 0-100,
    "manipulation_signs": ["list specific issues found"],
    "ai_generation_signs": ["list AI artifacts found"],
    "explanation": "2-3 sentence summary of your analysis"
}"""
        
        response = model.generate_content([
            {"mime_type": mime_type, "data": file_data},
            prompt
        ])
        
        # Parse response
        response_text = response.text.strip()
        
        # Try to extract JSON from response
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        parsed = json.loads(response_text)
        
        result["manipulation_detected"] = parsed.get("manipulation_detected", False)
        result["ai_generated"] = parsed.get("ai_generated", False)
        result["confidence"] = parsed.get("confidence", 50)
        result["manipulation_signs"] = parsed.get("manipulation_signs", [])
        result["ai_generation_signs"] = parsed.get("ai_generation_signs", [])
        result["explanation"] = parsed.get("explanation", "Analysis complete")
        
    except json.JSONDecodeError:
        result["explanation"] = f"Analysis complete (response parsing issue): {response_text[:200]}"
    except Exception as e:
        result["error"] = str(e)
        result["explanation"] = f"Analysis failed: {str(e)}"
    
    return result


def detect_deepfake_indicators(file_path: str) -> Dict[str, Any]:
    """
    Additional checks for deepfake indicators (simplified version).
    For a full implementation, you'd use specialized models.
    """
    result = {
        "face_detected": False,
        "deepfake_indicators": [],
        "confidence": 0
    }
    
    try:
        # Basic face detection with PIL
        img = Image.open(file_path)
        
        # This is a placeholder - in production you'd use:
        # - dlib or face_recognition library
        # - DeepFace
        # - Specialized deepfake detection models
        
        result["note"] = "Full deepfake detection requires specialized models"
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


def analyze_content(file_path: str, mime_type: str = "image/jpeg") -> ContentAnalysisResult:
    """
    Main function to analyze content for manipulation/AI generation.
    
    Combines multiple analysis techniques:
    1. Error Level Analysis (ELA) - local, fast
    2. Gemini AI Analysis - comprehensive
    3. Deepfake indicators (if applicable)
    
    Args:
        file_path: Path to the media file
        mime_type: MIME type of the file
        
    Returns:
        ContentAnalysisResult with all analysis information
    """
    # Run local ELA
    ela_result = perform_ela(file_path)
    
    # Run Gemini analysis
    gemini_result = analyze_with_gemini(file_path, mime_type)
    
    # Combine results
    manipulation_detected = (
        gemini_result.get("manipulation_detected", False) or 
        ela_result.get("suspicious", False)
    )
    
    ai_generated = gemini_result.get("ai_generated", False)
    
    # Adjust confidence based on ELA
    confidence = gemini_result.get("confidence", 50)
    if ela_result.get("suspicious") and not manipulation_detected:
        confidence = min(confidence, 60)  # Lower confidence if ELA suspicious
    
    # Build explanation
    explanations = []
    if gemini_result.get("explanation"):
        explanations.append(gemini_result["explanation"])
    if ela_result.get("suspicious"):
        explanations.append(f"ELA: {ela_result['explanation']}")
    
    return ContentAnalysisResult(
        manipulation_detected=manipulation_detected,
        ai_generated=ai_generated,
        confidence=confidence,
        manipulation_signs=gemini_result.get("manipulation_signs", []),
        ai_generation_signs=gemini_result.get("ai_generation_signs", []),
        ela_suspicious=ela_result.get("suspicious", False),
        ela_stats={
            "mean": ela_result.get("mean_error", 0),
            "std": ela_result.get("std_error", 0),
            "max": ela_result.get("max_error", 0)
        },
        explanation=" | ".join(explanations) if explanations else "Analysis complete"
    )
