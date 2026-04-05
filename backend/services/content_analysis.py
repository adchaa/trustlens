"""
Content Analysis Service - AI-powered manipulation detection
Uses Gemini API and local analysis techniques
"""
import json
import io
from importlib import import_module
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
from PIL import Image, ImageChops

genai = import_module("google.generativeai")

from config import GEMINI_API_KEY, GEMINI_MODEL, ELA_QUALITY
from models.schemas import ContentAnalysisResult

try:
    cv2 = import_module("cv2")
except ImportError:
    cv2 = None


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


def analyze_with_gemini(
    file_path: str,
    mime_type: str = "image/jpeg",
    alt_text: Optional[str] = None,
    potential_category: Optional[str] = None,
    model_confidence: Optional[int] = None,
) -> Dict[str, Any]:
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
    response_text = ""
    
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        # Read file
        file_data = Path(file_path).read_bytes()

        prior_model_signals = []
        if alt_text:
            prior_model_signals.append(f'Previous model alt text: "{alt_text}"')
        if potential_category and model_confidence is not None:
            prior_model_signals.append(
                f"Previous model category: {potential_category} ({model_confidence}% confidence)"
            )
        elif potential_category:
            prior_model_signals.append(f"Previous model category: {potential_category}")
        elif model_confidence is not None:
            prior_model_signals.append(f"Previous model confidence: {model_confidence}%")

        prior_model_context = ""
        if prior_model_signals:
            prior_model_context = (
                "\nPRIOR MODEL SIGNALS:\n- "
                + "\n- ".join(prior_model_signals)
                + "\nUse these prior signals as supporting evidence only. They may be incomplete or wrong.\n"
            )
        
        prompt = f"""You are an expert forensic analyst examining digital content for authenticity.{prior_model_context}

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
{{
    "manipulation_detected": true or false,
    "ai_generated": true or false,
    "confidence": 0-100,
    "manipulation_signs": ["list specific issues found"],
    "ai_generation_signs": ["list AI artifacts found"],
    "explanation": "2-3 sentence summary of your analysis"
}}"""
        
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
    Lightweight face-based heuristics for potential deepfake indicators.
    """
    result = {
        "face_detected": False,
        "deepfake_indicators": [],
        "confidence": 0,
        "explanation": ""
    }
    
    try:
        if cv2 is None:
            result["explanation"] = "OpenCV not installed; deepfake heuristics skipped"
            return result

        image = cv2.imread(file_path)
        if image is None:
            result["explanation"] = "Unable to load image for deepfake heuristics"
            return result

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))

        if len(faces) == 0:
            result["explanation"] = "No faces detected for deepfake heuristics"
            return result

        result["face_detected"] = True
        face_confidences = []

        for (x, y, w, h) in faces[:3]:
            face_region = gray[y:y + h, x:x + w]
            if face_region.size == 0:
                continue

            blur_score = float(cv2.Laplacian(face_region, cv2.CV_64F).var())
            texture_std = float(np.std(face_region))

            half_width = face_region.shape[1] // 2
            if half_width > 0:
                left = face_region[:, :half_width]
                right = cv2.flip(face_region[:, face_region.shape[1] - half_width:], 1)
                symmetry_diff = float(np.mean(cv2.absdiff(left, right)))
            else:
                symmetry_diff = 0.0

            face_flags = 0
            if blur_score < 45:
                result["deepfake_indicators"].append("Face region appears unusually smooth or blurred")
                face_flags += 1
            if texture_std < 28:
                result["deepfake_indicators"].append("Face texture variance is unusually low")
                face_flags += 1
            if 0 < symmetry_diff < 8:
                result["deepfake_indicators"].append("Facial symmetry appears unusually uniform")
                face_flags += 1

            face_confidences.append(min(100, face_flags * 25))

        deduped = []
        for indicator in result["deepfake_indicators"]:
            if indicator not in deduped:
                deduped.append(indicator)
        result["deepfake_indicators"] = deduped
        result["confidence"] = max(face_confidences, default=0)
        result["explanation"] = (
            "Face-based heuristics found visual patterns sometimes associated with synthesized or face-swapped imagery"
            if result["deepfake_indicators"]
            else "Detected faces did not show strong synthetic-face heuristic signals"
        )
    except Exception as e:
        result["error"] = str(e)
        result["explanation"] = f"Deepfake heuristics failed: {str(e)}"
    
    return result


def analyze_content(
    file_path: str,
    mime_type: str = "image/jpeg",
    alt_text: Optional[str] = None,
    potential_category: Optional[str] = None,
    model_confidence: Optional[int] = None,
) -> ContentAnalysisResult:
    """
    Main function to analyze content for manipulation/AI generation.
    
    Combines multiple analysis techniques:
    1. Error Level Analysis (ELA) - local, fast
    2. Gemini AI Analysis - comprehensive
    3. Deepfake indicators (if applicable)
    
    Args:
        file_path: Path to the media file
        mime_type: MIME type of the file
        alt_text: Image description from a previous model
        potential_category: Potential category predicted by a previous model
        model_confidence: Confidence score from a previous model
        
    Returns:
        ContentAnalysisResult with all analysis information
    """
    # Run local ELA
    ela_result = perform_ela(file_path)
    
    # Run Gemini analysis
    gemini_result = analyze_with_gemini(
        file_path,
        mime_type,
        alt_text=alt_text,
        potential_category=potential_category,
        model_confidence=model_confidence,
    )

    deepfake_result = {
        "face_detected": False,
        "deepfake_indicators": [],
        "confidence": 0,
        "explanation": "Deepfake heuristics skipped for non-image content"
    }
    if mime_type.startswith("image/"):
        deepfake_result = detect_deepfake_indicators(file_path)
    
    # Combine results
    manipulation_detected = (
        gemini_result.get("manipulation_detected", False) or 
        ela_result.get("suspicious", False)
    )
    
    ai_generated = gemini_result.get("ai_generated", False)
    if deepfake_result.get("confidence", 0) >= 50 and deepfake_result.get("deepfake_indicators"):
        ai_generated = True
    
    # Adjust confidence based on ELA
    confidence = gemini_result.get("confidence", 50)
    if ela_result.get("suspicious") and not manipulation_detected:
        confidence = min(confidence, 60)  # Lower confidence if ELA suspicious
    if deepfake_result.get("deepfake_indicators"):
        confidence = max(confidence, min(85, deepfake_result.get("confidence", 0) + 10))

    ai_generation_signs = list(gemini_result.get("ai_generation_signs", []))
    for indicator in deepfake_result.get("deepfake_indicators", []):
        if indicator not in ai_generation_signs:
            ai_generation_signs.append(indicator)
    
    # Build explanation
    explanations = []
    if gemini_result.get("explanation"):
        explanations.append(gemini_result["explanation"])
    if ela_result.get("suspicious"):
        explanations.append(f"ELA: {ela_result['explanation']}")
    if deepfake_result.get("explanation"):
        explanations.append(f"Face heuristics: {deepfake_result['explanation']}")
    if potential_category:
        prior_model_summary = f"Previous model suggested category '{potential_category}'"
        if model_confidence is not None:
            prior_model_summary += f" at {model_confidence}% confidence"
        explanations.append(f"Prior model signal: {prior_model_summary}")
    
    return ContentAnalysisResult(
        manipulation_detected=manipulation_detected,
        ai_generated=ai_generated,
        confidence=confidence,
        face_detected=deepfake_result.get("face_detected", False),
        deepfake_confidence=deepfake_result.get("confidence", 0),
        deepfake_indicators=deepfake_result.get("deepfake_indicators", []),
        manipulation_signs=gemini_result.get("manipulation_signs", []),
        ai_generation_signs=ai_generation_signs,
        ela_suspicious=ela_result.get("suspicious", False),
        ela_stats={
            "mean": ela_result.get("mean_error", 0),
            "std": ela_result.get("std_error", 0),
            "max": ela_result.get("max_error", 0)
        },
        explanation=" | ".join(explanations) if explanations else "Analysis complete"
    )
