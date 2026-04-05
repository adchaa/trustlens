import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Shield, 
  Camera, 
  Brain, 
  FileSearch,
  Globe,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import type { TrustCard as TrustCardType } from '../api/client';

interface TrustCardProps {
  data: TrustCardType;
  fileName: string;
  processingTime: number;
}

const VERDICT_CONFIG = {
  VERIFIED: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    iconColor: 'text-green-500',
    label: 'Verified',
  },
  UNCERTAIN: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-700',
    iconColor: 'text-yellow-500',
    label: 'Uncertain',
  },
  SUSPICIOUS: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconColor: 'text-red-500',
    label: 'Suspicious',
  },
};

function ScoreBar({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  const getColor = (s: number) => {
    if (s >= 75) return 'bg-green-500';
    if (s >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Icon className="w-4 h-4" />
          {label}
        </div>
        <span className="text-sm font-medium">{score}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(score)} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function DetailSection({ 
  title, 
  icon: Icon, 
  children,
  defaultOpen = false 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 font-medium text-gray-700">
          <Icon className="w-5 h-5" />
          {title}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      {isOpen && (
        <div className="p-4 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

export function TrustCard({ data, fileName, processingTime }: TrustCardProps) {
  const config = VERDICT_CONFIG[data.verdict];
  const VerdictIcon = config.icon;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header with Verdict */}
      <div className={`${config.bgColor} ${config.borderColor} border-b p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <VerdictIcon className={`w-16 h-16 ${config.iconColor}`} />
            <div>
              <h2 className={`text-3xl font-bold ${config.textColor}`}>
                {config.label}
              </h2>
              <p className="text-gray-600 mt-1">{fileName}</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${config.textColor}`}>
              {data.confidence}%
            </div>
            <div className="text-sm text-gray-500">Confidence</div>
          </div>
        </div>
      </div>

      {/* Summary Bullets */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3">Summary</h3>
        <ul className="space-y-2">
          {data.summary_bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-gray-700">
              <span className="text-blue-500 mt-1">•</span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      {/* Score Overview */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-4">Analysis Scores</h3>
        <ScoreBar label="Provenance" score={data.detailed_scores.provenance} icon={Shield} />
        <ScoreBar label="Content Analysis" score={data.detailed_scores.content} icon={Brain} />
        <ScoreBar label="Context Match" score={data.detailed_scores.context} icon={FileSearch} />
        <ScoreBar label="Source Credibility" score={data.detailed_scores.source} icon={Globe} />
      </div>

      {/* Detailed Analysis */}
      <div className="p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Detailed Analysis</h3>

        {/* Provenance Details */}
        <DetailSection title="Provenance" icon={Shield}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Content Credentials (C2PA)</span>
              <span className={data.provenance.has_c2pa ? 'text-green-600' : 'text-gray-400'}>
                {data.provenance.has_c2pa ? 'Found' : 'Not found'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">EXIF Metadata</span>
              <span className={data.provenance.has_exif ? 'text-green-600' : 'text-gray-400'}>
                {data.provenance.has_exif ? 'Present' : 'Missing'}
              </span>
            </div>
            {data.provenance.camera && (
              <div className="flex justify-between">
                <span className="text-gray-600">Camera</span>
                <span>{data.provenance.camera}</span>
              </div>
            )}
            {data.provenance.timestamp && (
              <div className="flex justify-between">
                <span className="text-gray-600">Timestamp</span>
                <span>{data.provenance.timestamp}</span>
              </div>
            )}
            {data.provenance.suspicious_signs.length > 0 && (
              <div className="mt-2 p-2 bg-yellow-50 rounded">
                <p className="text-yellow-800 font-medium">Warnings:</p>
                <ul className="list-disc list-inside text-yellow-700">
                  {data.provenance.suspicious_signs.map((sign, i) => (
                    <li key={i}>{sign}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-gray-500 mt-2 italic">{data.provenance.explanation}</p>
          </div>
        </DetailSection>

        {/* Content Analysis Details */}
        <DetailSection title="Content Analysis" icon={Brain}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Manipulation Detected</span>
              <span className={data.content_analysis.manipulation_detected ? 'text-red-600' : 'text-green-600'}>
                {data.content_analysis.manipulation_detected ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">AI Generated</span>
              <span className={data.content_analysis.ai_generated ? 'text-red-600' : 'text-green-600'}>
                {data.content_analysis.ai_generated ? 'Likely' : 'Unlikely'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ELA Analysis</span>
              <span className={data.content_analysis.ela_suspicious ? 'text-yellow-600' : 'text-green-600'}>
                {data.content_analysis.ela_suspicious ? 'Suspicious' : 'Normal'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Face Detection</span>
              <span className={data.content_analysis.face_detected ? 'text-green-600' : 'text-gray-400'}>
                {data.content_analysis.face_detected ? 'Face found' : 'No face found'}
              </span>
            </div>
            {data.content_analysis.face_detected && (
              <div className="flex justify-between">
                <span className="text-gray-600">Deepfake Heuristic Confidence</span>
                <span>{data.content_analysis.deepfake_confidence}%</span>
              </div>
            )}
            {data.content_analysis.manipulation_signs.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 rounded">
                <p className="text-red-800 font-medium">Manipulation Signs:</p>
                <ul className="list-disc list-inside text-red-700">
                  {data.content_analysis.manipulation_signs.map((sign, i) => (
                    <li key={i}>{sign}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.content_analysis.ai_generation_signs.length > 0 && (
              <div className="mt-2 p-2 bg-purple-50 rounded">
                <p className="text-purple-800 font-medium">AI Generation Signs:</p>
                <ul className="list-disc list-inside text-purple-700">
                  {data.content_analysis.ai_generation_signs.map((sign, i) => (
                    <li key={i}>{sign}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.content_analysis.deepfake_indicators.length > 0 && (
              <div className="mt-2 p-2 bg-orange-50 rounded">
                <p className="text-orange-800 font-medium">Face Heuristic Indicators:</p>
                <ul className="list-disc list-inside text-orange-700">
                  {data.content_analysis.deepfake_indicators.map((sign, i) => (
                    <li key={i}>{sign}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-gray-500 mt-2 italic">{data.content_analysis.explanation}</p>
          </div>
        </DetailSection>

        {/* Context Details */}
        <DetailSection title="Context Verification" icon={FileSearch}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Context Match</span>
              <span className={data.context.context_match ? 'text-green-600' : 'text-red-600'}>
                {data.context.context_match ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Caption Matches Content</span>
              <span className={data.context.caption_matches_content ? 'text-green-600' : 'text-red-600'}>
                {data.context.caption_matches_content ? 'Yes' : 'No'}
              </span>
            </div>
            {data.context.detected_elements.length > 0 && (
              <div className="mt-2">
                <p className="text-gray-600 font-medium">Detected Elements:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.context.detected_elements.map((el, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {el}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.context.inconsistencies.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 rounded">
                <p className="text-red-800 font-medium">Inconsistencies:</p>
                <ul className="list-disc list-inside text-red-700">
                  {data.context.inconsistencies.map((inc, i) => (
                    <li key={i}>{inc}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.context.reverse_search_matches.length > 0 && (
              <div className="mt-2 p-2 bg-indigo-50 rounded">
                <p className="text-indigo-800 font-medium">Reverse Search Matches:</p>
                <ul className="list-disc list-inside text-indigo-700 break-all">
                  {data.context.reverse_search_matches.map((match, i) => (
                    <li key={i}>{match}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-gray-500 mt-2 italic">{data.context.explanation}</p>
          </div>
        </DetailSection>

        {/* Source Details */}
        {data.source && (
          <DetailSection title="Source Credibility" icon={Globe}>
            <div className="space-y-2 text-sm">
              {data.source.domain && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Domain</span>
                  <span>{data.source.domain}</span>
                </div>
              )}
              {data.source.domain_age_days !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Domain Age</span>
                  <span>{data.source.domain_age_days} days</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">SSL Certificate</span>
                <span className={data.source.has_ssl ? 'text-green-600' : 'text-red-600'}>
                  {data.source.has_ssl ? 'Valid' : 'Invalid/Missing'}
                </span>
              </div>
              {data.source.suspicious_patterns.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 rounded">
                  <p className="text-yellow-800 font-medium">Warnings:</p>
                  <ul className="list-disc list-inside text-yellow-700">
                    {data.source.suspicious_patterns.map((pattern, i) => (
                      <li key={i}>{pattern}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-gray-500 mt-2 italic">{data.source.explanation}</p>
            </div>
          </DetailSection>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
        Analysis completed in {processingTime}ms
      </div>
    </div>
  );
}
