import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface AnalysisRequest {
  fileUrl: string;
  caption?: string;
  claimedDate?: string;
  claimedLocation?: string;
  sourceUrl?: string;
  altText?: string;
  category?: string;
  confidence?: number;
}

export interface TrustCard {
  verdict: 'VERIFIED' | 'UNCERTAIN' | 'SUSPICIOUS';
  verdict_color: string;
  confidence: number;
  summary_bullets: string[];
  detailed_scores: {
    provenance: number;
    content: number;
    context: number;
    source: number;
  };
  provenance: {
    has_c2pa: boolean;
    has_exif: boolean;
    c2pa_valid: boolean | null;
    camera: string | null;
    timestamp: string | null;
    gps: { latitude: number; longitude: number } | null;
    software: string | null;
    suspicious_signs: string[];
    provenance_score: number;
    explanation: string;
  };
  content_analysis: {
    manipulation_detected: boolean;
    ai_generated: boolean;
    confidence: number;
    face_detected: boolean;
    deepfake_confidence: number;
    deepfake_indicators: string[];
    manipulation_signs: string[];
    ai_generation_signs: string[];
    ela_suspicious: boolean;
    explanation: string;
  };
  context: {
    context_match: boolean;
    confidence: number;
    caption_matches_content: boolean;
    detected_elements: string[];
    inconsistencies: string[];
    reverse_search_matches: string[];
    explanation: string;
  };
  source: {
    domain: string | null;
    domain_age_days: number | null;
    has_ssl: boolean;
    suspicious_patterns: string[];
    credibility_score: number;
    explanation: string;
  } | null;
}

export interface AnalysisResponse {
  success: boolean;
  file_name: string;
  file_type: string;
  trust_card: TrustCard;
  processing_time_ms: number;
}

export async function analyzeContent(request: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await axios.post<AnalysisResponse>(
    `${API_BASE_URL}/analyze`,
    {
      file_url: request.fileUrl,
      caption: request.caption,
      claimed_date: request.claimedDate,
      claimed_location: request.claimedLocation,
      source_url: request.sourceUrl,
      alt_text: request.altText,
      category: request.category,
      confidence: request.confidence,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await axios.get(`${API_BASE_URL}/health`);
  return response.data;
}
