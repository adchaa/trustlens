"""
Provenance Service - C2PA and EXIF extraction
Checks for Content Credentials and metadata authenticity
"""
import json
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import exifread

from models.schemas import ProvenanceResult
from c2pa import Reader, Context, Settings


def parse_gps_coordinate(gps_coords, gps_ref) -> Optional[float]:
    """Convert GPS coordinates to decimal degrees."""
    try:
        degrees = float(gps_coords[0])
        minutes = float(gps_coords[1])
        seconds = float(gps_coords[2])
        
        decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
        
        if gps_ref in ['S', 'W']:
            decimal = -decimal
            
        return round(decimal, 6)
    except:
        return None


def extract_gps_from_exif(gps_info: dict) -> Optional[Dict[str, float]]:
    """Extract GPS coordinates from EXIF GPS info."""
    try:
        lat = parse_gps_coordinate(
            gps_info.get(2, [0, 0, 0]),  # GPSLatitude
            str(gps_info.get(1, 'N'))     # GPSLatitudeRef
        )
        lon = parse_gps_coordinate(
            gps_info.get(4, [0, 0, 0]),  # GPSLongitude
            str(gps_info.get(3, 'E'))     # GPSLongitudeRef
        )
        
        if lat and lon:
            return {"latitude": lat, "longitude": lon}
    except:
        pass
    return None


def check_c2pa(file_path: str) -> Dict[str, Any]:
    """Extract C2PA Content Credentials from file."""
    result = {
        "has_c2pa": False,
        "c2pa_valid": None,
        "active_manifest": None,
        "manifests": {},
        "validation_errors": []
    }
    
    try:
        settings = Settings.from_dict({
            "verify": {"verify_cert_anchors": False}  # Relaxed for demo
        })
        
        with Context(settings) as ctx:
            with Reader(file_path, context=ctx) as reader:
                manifest_store = json.loads(reader.json())
                
                result["has_c2pa"] = True
                result["active_manifest"] = manifest_store.get("active_manifest")
                result["manifests"] = manifest_store.get("manifests", {})
                
                # Check for validation issues
                validation_status = manifest_store.get("validation_status", [])
                if validation_status:
                    result["validation_errors"] = validation_status
                    result["c2pa_valid"] = False
                else:
                    result["c2pa_valid"] = True
                    
    except Exception as e:
        error_msg = str(e)
        # "no manifest" is expected for most files
        if "no manifest" not in error_msg.lower():
            result["error"] = error_msg
    
    return result


def extract_exif(file_path: str) -> Dict[str, Any]:
    """Extract EXIF metadata from image file."""
    result = {
        "has_exif": False,
        "camera_make": None,
        "camera_model": None,
        "timestamp": None,
        "software": None,
        "gps": None,
        "all_tags": {}
    }
    
    try:
        # Method 1: PIL
        img = Image.open(file_path)
        exif_data = img._getexif()
        
        if exif_data:
            result["has_exif"] = True
            
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                
                # Convert bytes to string if needed
                if isinstance(value, bytes):
                    try:
                        value = value.decode('utf-8', errors='ignore')
                    except:
                        value = str(value)
                
                if tag == "Make":
                    result["camera_make"] = str(value).strip()
                elif tag == "Model":
                    result["camera_model"] = str(value).strip()
                elif tag == "DateTime" or tag == "DateTimeOriginal":
                    result["timestamp"] = str(value)
                elif tag == "Software":
                    result["software"] = str(value)
                elif tag == "GPSInfo":
                    result["gps"] = extract_gps_from_exif(value)
                
                # Store simplified tag
                result["all_tags"][tag] = str(value)[:100]
        
        # Method 2: exifread for more details
        with open(file_path, 'rb') as f:
            tags = exifread.process_file(f, details=False)
            if tags:
                result["has_exif"] = True
                for tag, value in tags.items():
                    if tag not in result["all_tags"]:
                        result["all_tags"][tag] = str(value)[:100]
                        
    except Exception as e:
        result["error"] = str(e)
    
    return result


def detect_suspicious_signs(exif_result: Dict, c2pa_result: Dict) -> list:
    """Detect suspicious patterns in metadata."""
    suspicious = []
    
    # No metadata at all
    if not exif_result.get("has_exif") and not c2pa_result.get("has_c2pa"):
        suspicious.append("No metadata found - possibly stripped")
    
    # Editing software detected
    software = exif_result.get("software", "")
    if software:
        editing_tools = ["photoshop", "gimp", "lightroom", "snapseed", "picsart", "facetune"]
        for tool in editing_tools:
            if tool in software.lower():
                suspicious.append(f"Edited with {software}")
                break
    
    # C2PA validation errors
    if c2pa_result.get("validation_errors"):
        suspicious.append("C2PA validation failed")
    
    # Timestamp issues
    timestamp = exif_result.get("timestamp")
    if timestamp:
        # Check for default/placeholder dates
        if timestamp.startswith("0000") or timestamp.startswith("1970"):
            suspicious.append("Invalid timestamp detected")
    
    return suspicious


def calculate_provenance_score(c2pa_result: Dict, exif_result: Dict, suspicious: list) -> Tuple[int, str]:
    """Calculate provenance trust score (0-100)."""
    score = 50  # Base score
    explanations = []
    
    # C2PA is strongest signal (+30 to +50)
    if c2pa_result.get("has_c2pa"):
        if c2pa_result.get("c2pa_valid"):
            score += 45
            explanations.append("Valid C2PA Content Credentials")
        else:
            score += 20
            explanations.append("C2PA present but has issues")
    
    # EXIF presence (+10 to +20)
    if exif_result.get("has_exif"):
        score += 10
        explanations.append("EXIF metadata present")
        
        if exif_result.get("camera_make") or exif_result.get("camera_model"):
            score += 5
            camera = f"{exif_result.get('camera_make', '')} {exif_result.get('camera_model', '')}".strip()
            explanations.append(f"Camera: {camera}")
        
        if exif_result.get("gps"):
            score += 5
            explanations.append("GPS location embedded")
    
    # Deductions for suspicious signs
    score -= len(suspicious) * 10
    
    score = max(0, min(100, score))
    explanation = "; ".join(explanations) if explanations else "No provenance data found"
    
    return score, explanation


def check_provenance(file_path: str) -> ProvenanceResult:
    """
    Main function to check content provenance.
    
    Args:
        file_path: Path to the media file
        
    Returns:
        ProvenanceResult with all provenance information
    """
    # Run checks
    c2pa_result = check_c2pa(file_path)
    exif_result = extract_exif(file_path)
    suspicious_signs = detect_suspicious_signs(exif_result, c2pa_result)
    score, explanation = calculate_provenance_score(c2pa_result, exif_result, suspicious_signs)
    
    # Build camera string
    camera = None
    if exif_result.get("camera_make") or exif_result.get("camera_model"):
        camera = f"{exif_result.get('camera_make', '')} {exif_result.get('camera_model', '')}".strip()
    
    return ProvenanceResult(
        has_c2pa=c2pa_result.get("has_c2pa", False),
        has_exif=exif_result.get("has_exif", False),
        c2pa_valid=c2pa_result.get("c2pa_valid"),
        active_manifest=c2pa_result.get("active_manifest"),
        camera=camera,
        timestamp=exif_result.get("timestamp"),
        gps=exif_result.get("gps"),
        software=exif_result.get("software"),
        suspicious_signs=suspicious_signs,
        provenance_score=score,
        explanation=explanation
    )
