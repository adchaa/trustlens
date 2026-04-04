import { Loader2 } from 'lucide-react';

interface LoadingProps {
  fileName: string;
}

const ANALYSIS_STEPS = [
  'Extracting metadata...',
  'Checking provenance...',
  'Analyzing content...',
  'Verifying context...',
  'Generating trust card...',
];

export function Loading({ fileName }: LoadingProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8 text-center">
      <Loader2 className="w-16 h-16 mx-auto mb-6 text-blue-500 animate-spin" />
      
      <h3 className="text-xl font-semibold text-gray-800 mb-2">
        Analyzing Content
      </h3>
      
      <p className="text-gray-600 mb-6">
        {fileName}
      </p>
      
      <div className="space-y-2 text-left max-w-xs mx-auto">
        {ANALYSIS_STEPS.map((step, index) => (
          <div 
            key={step}
            className="flex items-center gap-2 text-sm text-gray-500"
            style={{ 
              animation: `fadeIn 0.5s ease-in-out ${index * 0.8}s both` 
            }}
          >
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            {step}
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
