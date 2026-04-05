import { useState } from 'react';
import { Shield, AlertCircle, Link } from 'lucide-react';
import { Loading } from './components/Loading';
import { TrustCard } from './components/TrustCard';
import { analyzeContent, AnalysisResponse } from './api/client';

function App() {
  const [fileUrl, setFileUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Context fields
  const [caption, setCaption] = useState('');
  const [claimedDate, setClaimedDate] = useState('');
  const [claimedLocation, setClaimedLocation] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [category, setCategory] = useState('');
  const [confidence, setConfidence] = useState('');

  const handleAnalyze = async () => {
    if (!fileUrl.trim()) return;

    const parsedConfidence =
      confidence.trim() === '' ? undefined : Number(confidence);

    if (
      parsedConfidence !== undefined &&
      (Number.isNaN(parsedConfidence) || parsedConfidence < 0 || parsedConfidence > 100)
    ) {
      setError('Previous model confidence must be a number between 0 and 100.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await analyzeContent({
        fileUrl: fileUrl.trim(),
        caption: caption || undefined,
        claimedDate: claimedDate || undefined,
        claimedLocation: claimedLocation || undefined,
        sourceUrl: sourceUrl || undefined,
        altText: altText || undefined,
        category: category || undefined,
        confidence: parsedConfidence,
      });
      setResult(response);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFileUrl('');
    setResult(null);
    setError(null);
    setCaption('');
    setClaimedDate('');
    setClaimedLocation('');
    setSourceUrl('');
    setAltText('');
    setCategory('');
    setConfidence('');
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">TrustLens</h1>
              <p className="text-sm text-gray-500">Content Authenticity Verification</p>
            </div>
          </div>
          {(fileUrl || result) && (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              New Analysis
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <Loading fileName={fileUrl} />
        ) : result ? (
          <TrustCard 
            data={result.trust_card} 
            fileName={result.file_name}
            processingTime={result.processing_time_ms}
          />
        ) : (
          <div className="space-y-6">
            {/* File URL Input */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Enter File URL to Verify
              </h2>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="url"
                  value={fileUrl}
                  onChange={(e) => {
                    setFileUrl(e.target.value);
                    setResult(null);
                    setError(null);
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Enter a direct URL to an image, video, audio, or document file
              </p>
              
              {fileUrl && isValidUrl(fileUrl) && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center gap-3">
                  <Link className="w-5 h-5 text-blue-600" />
                  <div className="flex-1 overflow-hidden">
                    <p className="font-medium text-gray-800 truncate">{fileUrl}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Context Fields */}
            {fileUrl && isValidUrl(fileUrl) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Context Information (Optional)
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Provide context to verify if the content matches the claims being made about it.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Caption / Claim
                    </label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Enter the caption or claim associated with this content..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Previous Model Alt Text
                    </label>
                    <textarea
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      placeholder="Description generated by a previous model..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Claimed Date
                      </label>
                      <input
                        type="text"
                        value={claimedDate}
                        onChange={(e) => setClaimedDate(e.target.value)}
                        placeholder="e.g., April 2024"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Claimed Location
                      </label>
                      <input
                        type="text"
                        value={claimedLocation}
                        onChange={(e) => setClaimedLocation(e.target.value)}
                        placeholder="e.g., Paris, France"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Previous Model Category
                      </label>
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g., AI-generated"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Previous Model Confidence
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={confidence}
                        onChange={(e) => setConfidence(e.target.value)}
                        placeholder="0-100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Source URL
                    </label>
                    <input
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Analyze Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={!fileUrl || !isValidUrl(fileUrl) || isLoading}
                  className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                >
                  Analyze Content
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Analysis Failed</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500">
        Built for MENACRAFT Hackathon 2026
      </footer>
    </div>
  );
}

export default App;
