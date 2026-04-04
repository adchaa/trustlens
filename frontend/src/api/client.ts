import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface AnalysisRequest {
  file: File;
  caption?: string;
  claimedDate?: string;
  claimedLocation?: string;
  sourceUrl?: string;
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
  const formData = new FormData();
  formData.append('file', request.file);
  
  if (request.caption) {
    formData.append('caption', request.caption);
  }
  if (request.claimedDate) {
    formData.append('claimed_date', request.claimedDate);
  }
  if (request.claimedLocation) {
    formData.append('claimed_location', request.claimedLocation);
  }
  if (request.sourceUrl) {
    formData.append('source_url', request.sourceUrl);
  }

  const response = await axios.post<AnalysisResponse>(
    `${API_BASE_URL}/analyze`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await axios.get(`${API_BASE_URL}/health`);
  return response.data;
}
