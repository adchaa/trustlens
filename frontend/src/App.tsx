import { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { UploadZone } from './components/Upload';
import { Loading } from './components/Loading';
import { TrustCard } from './components/TrustCard';
import { analyzeContent, AnalysisResponse } from './api/client';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Context fields
  const [caption, setCaption] = useState('');
  const [claimedDate, setClaimedDate] = useState('');
  const [claimedLocation, setClaimedLocation] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await analyzeContent({
        file: selectedFile,
        caption: caption || undefined,
        claimedDate: claimedDate || undefined,
        claimedLocation: claimedLocation || undefined,
        sourceUrl: sourceUrl || undefined,
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
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setCaption('');
    setClaimedDate('');
    setClaimedLocation('');
    setSourceUrl('');
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
          {(selectedFile || result) && (
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
          <Loading fileName={selectedFile?.name || 'file'} />
        ) : result ? (
          <TrustCard 
            data={result.trust_card} 
            fileName={result.file_name}
            processingTime={result.processing_time_ms}
          />
        ) : (
          <div className="space-y-6">
            {/* Upload Zone */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Upload Content to Verify
              </h2>
              <UploadZone onFileSelect={handleFileSelect} isLoading={isLoading} />
              
              {selectedFile && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Context Fields */}
            {selectedFile && (
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
                  
                  <div className="grid grid-cols-2 gap-4">
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
                  disabled={!selectedFile || isLoading}
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
