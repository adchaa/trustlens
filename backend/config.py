"""
TrustLens Configuration
Set your API keys here or via environment variables
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# API Keys - Set these in your environment or replace directly
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "your-gemini-api-key-here")
GOOGLE_CLOUD_API_KEY = os.getenv("GOOGLE_CLOUD_API_KEY", "")  # Optional: for Vision API
GOOGLE_FACTCHECK_API_KEY = os.getenv("GOOGLE_FACTCHECK_API_KEY", "")  # Optional

# Gemini Model Configuration
GEMINI_MODEL = "gemini-2.5-flash"  # Latest with free quota
# Alternatives if quota runs out:
# GEMINI_MODEL = "gemini-1.5-flash"  
# GEMINI_MODEL = "gemini-2.5-flash-lite-preview-06-17"

# File Upload Settings
MAX_FILE_SIZE_MB = 50
ALLOWED_EXTENSIONS = {
    "image": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"],
    "video": [".mp4", ".mov", ".avi", ".webm"],
    "audio": [".mp3", ".wav", ".m4a", ".ogg"],
    "document": [".pdf", ".docx"]
}

# Paths
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Analysis Settings
ANALYSIS_TIMEOUT_SECONDS = 60
ELA_QUALITY = 90  # JPEG quality for Error Level Analysis

# Trust Score Weights
SCORE_WEIGHTS = {
    "provenance": 0.30,
    "content": 0.35,
    "context": 0.25,
    "source": 0.10
}

# Verdict Thresholds
VERDICT_THRESHOLDS = {
    "verified": 75,
    "uncertain": 50
}
