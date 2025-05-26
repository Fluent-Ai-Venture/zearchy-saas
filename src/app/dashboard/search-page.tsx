"use client";

// Add export for Next.js to skip pre-rendering this page during build
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { UserButton } from "@clerk/nextjs";
import TrieVisualizer from '@/components/TrieVisualizer';
import { TrieVisualizationNode } from '@/lib/ziptrie';

interface UploadedData {
  dataId: string;
  fields: string[];
  totalRecords: number;
  lastUpdated: string;
}

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultFields, setResultFields] = useState<string[]>([]);
  const [trieData, setTrieData] = useState<TrieVisualizationNode | null>(null);
  const [searchPath, setSearchPath] = useState<TrieVisualizationNode[] | null>(null);
  const [searchPerformance, setSearchPerformance] = useState({ time: 0, resultsCount: 0 });

  // Load user data on mount
  useEffect(() => {
    if (user?.id) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/data');
      const data = await response.json();
      
      if (response.ok && data.dataId) {
        setUploadedData({
          dataId: data.dataId,
          fields: data.fields || [],
          totalRecords: data.totalRecords || 0,
          lastUpdated: data.lastUpdated || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Perform search when query changes
  useEffect(() => {
    if (!searchQuery || !uploadedData?.dataId) return;
    
    const searchTimeout = setTimeout(() => {
      performSearch();
    }, 300);
    
    return () => clearTimeout(searchTimeout);
  }, [searchQuery, uploadedData]);

  const performSearch = async () => {
    if (!searchQuery || !uploadedData?.dataId) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const startTime = performance.now();
      
      // Construct search URL with current values
      const searchUrl = `/api/search?q=${encodeURIComponent(searchQuery)}&dataId=${encodeURIComponent(uploadedData.dataId)}`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      const endTime = performance.now();
      const searchTimeMs = endTime - startTime;
      
      console.log('Search response:', data);
      
      if (response.ok && data.results) {
        setSearchResults(data.results);
        
        // Update performance metrics
        setSearchPerformance({
          time: searchTimeMs,
          resultsCount: data.results.length
        });
        
        // Extract fields from results for table headers
        if (data.results.length > 0) {
          const firstResult = data.results[0];
          const fields = Object.keys(firstResult).filter(key => key !== 'score');
          setResultFields(fields);
        }
        
        // Update visualization if available
        if (data.trieVisualization) {
          setTrieData(data.trieVisualization);
        }
        
        if (data.searchPath) {
          setSearchPath(data.searchPath);
        }
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during search');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-black">Zearchy Dashboard</h1>
          {isLoaded && <UserButton />}
        </div>
        
        {/* Main content */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-black mb-4">Search Your Data</h2>
          
          {!uploadedData && (
            <div className="bg-yellow-50 p-4 rounded-md text-black border border-yellow-200">
              <p>Please upload data first to enable search.</p>
            </div>
          )}
          
          {uploadedData && (
            <>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full p-3 border border-gray-300 rounded-md text-black"
                  disabled={isSearching}
                />
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
              
              {error && (
                <div className="mt-2 text-sm text-red-600">{error}</div>
              )}
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-black">Search Results ({searchResults.length})</h3>
                    
                    {/* Performance Metrics */}
                    {searchPerformance.time > 0 && (
                      <div className="text-sm text-black bg-blue-50 px-3 py-1 rounded-md">
                        <span className="font-medium">Search Time:</span> {searchPerformance.time.toFixed(2)}ms | 
                        <span className="font-medium"> Speed:</span> {(searchPerformance.resultsCount / (searchPerformance.time / 1000)).toFixed(0)} results/second
                      </div>
                    )}
                  </div>
                  
                  <div className="overflow-auto max-h-96 border rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {resultFields.map((field) => (
                            <th
                              key={field}
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider"
                            >
                              {field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {searchResults.map((result, index) => (
                          <tr key={index}>
                            {resultFields.map((field) => (
                              <td key={field} className="px-6 py-4 whitespace-nowrap text-sm text-black">
                                {String(result[field] || '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {searchResults.length === 0 && searchQuery && !isSearching && (
                <div className="bg-gray-50 p-4 rounded-md text-black text-base border border-gray-200 mt-4">
                  No results found. Try a different search term.
                </div>
              )}
              
              {/* ZipTrie Visualization */}
              <div className="mt-8">
                <TrieVisualizer 
                  treeData={trieData} 
                  searchPath={searchPath} 
                  searchQuery={searchQuery} 
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
