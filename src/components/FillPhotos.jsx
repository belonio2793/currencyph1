import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function FillPhotos() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(50);

  const handleFillPhotos = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: err } = await supabase.functions.invoke(
        'fill-photo-urls',
        {
          body: { limit: parseInt(limit) },
        }
      );

      if (err) {
        throw err;
      }

      setResult(data);
    } catch (e) {
      setError(e.message || 'Failed to fill photos');
      console.error('Fill photos error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          📸 Fill Empty Photo URLs
        </h2>
        <p className="text-gray-600">
          Find listings with empty photo_urls and scrape TripAdvisor.com.ph photo galleries
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max listings to process
          </label>
          <input
            type="number"
            min="1"
            max="500"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Default: 50. Only processes listings with empty photo_urls
          </p>
        </div>

        <button
          onClick={handleFillPhotos}
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <span className="animate-spin mr-2">⏳</span>
              Processing... (this may take a few minutes)
            </span>
          ) : (
            '🚀 Start Filling Photos'
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <h3 className="text-red-900 font-semibold mb-1">❌ Error</h3>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-green-900 font-semibold mb-3">✅ Complete!</h3>
          <div className="space-y-2 text-sm text-green-800 mb-4">
            <p>
              <span className="font-semibold">Processed:</span> {result.processed} listings
            </p>
            <p>
              <span className="font-semibold">Updated:</span> {result.updated} with photos
            </p>
            {result.message && (
              <p className="text-gray-700">{result.message}</p>
            )}
          </div>

          {result.results && result.results.length > 0 && (
            <div className="mt-4 pt-4 border-t border-green-200 max-h-80 overflow-y-auto">
              <p className="font-semibold text-sm mb-2">Updates:</p>
              <div className="space-y-2">
                {result.results.map((r, idx) => (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded ${
                      r.success
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs opacity-80">{r.city}</div>
                    {r.success ? (
                      <div className="text-xs">✓ {r.count} photos added</div>
                    ) : (
                      <div className="text-xs">✗ {r.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
