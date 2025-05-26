// src/app/dashboard/page.tsx
"use client";

// Add export for Next.js to skip pre-rendering this page during build
export const dynamic = 'force-dynamic';
export const runtime = 'edge';


import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import DatasetsTab from './datasets-tab';
import LocalSearchTab from './local-search-tab';
import ApiKeysTab from './api-keys-tab';

type UploadedData = {
  dataId?: string;
  preview: Record<string, unknown>[];
  fields: string[];
  totalRecords: number;
};

type SearchPerformance = {
  clientTime: number;  // Total time including network
  serverTime: number;  // Pure algorithm time
  resultsCount: number;
};

// File upload zone component
const FileUploadZone = ({ 
  onDrop, 
  isUploading, 
  uploadError, 
  uploadStatus 
}: { 
  onDrop: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>; 
  isUploading: boolean; 
  uploadError: string | null;
  uploadStatus: string;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer">
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={onDrop}
        accept=".csv,.json"
        className="hidden"
        id="file-upload"
      />
      <div className="mb-4">
        <svg
          className="mx-auto h-12 w-12 text-black"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>
      <label htmlFor="file-upload" className="cursor-pointer">
        <span className="mt-2 block text-sm font-medium text-black">
          {isUploading ? (
            <span className="text-blue-600">{uploadStatus}</span>
          ) : (
            <span>
              <span className="text-blue-600 font-semibold">Click to upload</span> or drag and drop
            </span>
          )}
        </span>
        <span className="mt-1 block text-xs text-black">CSV or JSON up to 10MB</span>
      </label>
      {uploadError && (
        <div className="mt-2 text-sm text-red-600">{uploadError}</div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  
  // Get tab from URL or default to 'datasets'
  const tabParam = searchParams.get('tab');
  const datasetIdParam = searchParams.get('datasetId');
  const [activeTab, setActiveTab] = useState(tabParam || 'datasets');
  
  // Track if we've loaded the dataset from the URL parameter
  const [loadedDatasetFromUrl, setLoadedDatasetFromUrl] = useState(false);
  
  // Original state for backward compatibility
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [returnableFields, setReturnableFields] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [searchPerformance, setSearchPerformance] = useState<SearchPerformance>({ clientTime: 0, serverTime: 0, resultsCount: 0 });
  
  const uploadedDataRef = useRef<UploadedData | null>(null);
  const selectedFieldsRef = useRef<string[]>([]);
  const searchQueryRef = useRef<string>('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update the URL when tab changes
  useEffect(() => {
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('tab', activeTab);
    const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeTab]);
  
  // Load dataset when datasetId parameter is present
  useEffect(() => {
    const loadDatasetFromId = async (datasetId: string) => {
      console.log('Loading dataset with ID:', datasetId);
      setIsSearching(true);
      setUploadError(null);
      
      try {
        // Fetch the dataset details
        const response = await fetch(`/api/datasets/${datasetId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load dataset: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Dataset loaded:', data);
        
        if (data && data.dataset) {
          // Set the uploaded data
          const datasetData = {
            dataId: data.dataset.id,
            preview: data.dataset.preview || [],
            fields: data.dataset.fields || [],
            totalRecords: data.dataset.itemCount || 0
          };
          
          setUploadedData(datasetData);
          uploadedDataRef.current = datasetData;
          
          // Set the search fields
          setSelectedFields(data.dataset.fields || []);
          selectedFieldsRef.current = data.dataset.fields || [];
          
          // Set the returnable fields
          setReturnableFields(data.dataset.fields || []);
          
          // Set the search query ref to empty string to ensure it's initialized
          searchQueryRef.current = '';
          
          setLoadedDatasetFromUrl(true);
        } else {
          throw new Error('Invalid dataset data received');
        }
      } catch (error) {
        console.error('Error loading dataset:', error);
        setUploadError(error instanceof Error ? error.message : 'Failed to load dataset');
      } finally {
        setIsSearching(false);
      }
    };
    
    // Load the dataset if datasetId is present and we haven't loaded it yet
    if (datasetIdParam && !loadedDatasetFromUrl) {
      loadDatasetFromId(datasetIdParam);
    }
  }, [datasetIdParam, loadedDatasetFromUrl, setIsSearching, setUploadError, setUploadedData, setSelectedFields, setReturnableFields]);
  
  // Update refs when state changes (for backward compatibility)
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);
  
  useEffect(() => {
    uploadedDataRef.current = uploadedData;
    
    // Set returnable fields when data is uploaded
    if (uploadedData && uploadedData.fields) {
      setReturnableFields(uploadedData.fields);
    }
  }, [uploadedData]);
  
  useEffect(() => {
    selectedFieldsRef.current = selectedFields;
  }, [selectedFields]);
  
  // Handle file uploads
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size and type before uploading
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      setUploadError(`File too large: ${fileSizeMB.toFixed(2)} MB. Maximum size is 50 MB.`);
      return;
    }
    
    // Check file type
    const fileType = file.name.split('.').pop()?.toLowerCase();
    if (fileType !== 'json' && fileType !== 'csv') {
      setUploadError('Only JSON and CSV files are supported.');
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadError(null);
      
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`Uploading file: ${file.name} (${fileSizeMB} MB)`);
      
      // Create upload status message
      setUploadStatus(`Uploading ${file.name} (${fileSizeMB} MB)...`);
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Set up timeout to provide feedback for large files
      const uploadStartTime = Date.now();
      const uploadStatusInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - uploadStartTime) / 1000);
        setUploadStatus(`Processing ${file.name} (${fileSizeMB} MB)... ${elapsedSeconds}s elapsed`);
      }, 1000);
      
      // Make sure to set the correct content type for the fetch request
      console.log('Sending file to server...');
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      clearInterval(uploadStatusInterval);
      console.log('Response received, status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);
      
      // Check if the response is HTML (error page) instead of JSON
      const contentType = response.headers.get('content-type');
      console.log('Content-Type:', contentType);
      
      if (!response.ok || (contentType && contentType.includes('text/html'))) {
        console.error('Response not OK or HTML content detected');
        
        try {
          // Try to get the response as text first
          const responseText = await response.text();
          console.log('Response text (first 200 chars):', responseText.substring(0, 200));
          
          // If it looks like HTML, extract a more useful error message
          if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html>')) {
            console.error('Server returned HTML instead of JSON');
            
            // Try to extract error message from HTML if possible
            const errorMatch = responseText.match(/<pre.*?>[\s\S]*?<\/pre>/);
            const errorMessage = errorMatch 
              ? errorMatch[0].replace(/<\/?pre.*?>/g, '').trim() 
              : 'Server returned HTML instead of JSON. Check server logs for details.';
            
            throw new Error(`Server error: ${errorMessage}`);
          } else {
            // Try to parse as JSON if it doesn't look like HTML
            try {
              const errorData = JSON.parse(responseText);
              throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
            } catch (parseError) {
              // If JSON parsing fails, return the raw text
              console.error('Failed to parse response as JSON:', parseError);
              throw new Error(`Server error (${response.status}): Response is not valid JSON. Check server logs.`);
            }
          }
        } catch (textError) {
          // If we can't even get the response as text, fall back to a generic error
          console.error('Error processing response:', textError);
          if (textError instanceof Error) {
            throw textError;
          } else {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }
        }
      }
      
      // Parse response as JSON
      let data;
      try {
        data = await response.json();
        console.log('Response parsed as JSON successfully');
      } catch (jsonError) {
        console.error('Error parsing response as JSON:', jsonError);
        throw new Error('Failed to parse server response as JSON. The server might be returning an error page instead of JSON data.');
      }
      
      // Check if response indicates an error
      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
      }
      
      // Calculate initial processing time
      const initialProcessingTime = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
      setUploadStatus(`Processed file in ${initialProcessingTime} seconds. Ready for search!`);
      
      console.log('Upload successful, data:', data);
      
      // Set the uploaded data
      setUploadedData({
        dataId: data.dataId,
        preview: data.data || [],
        fields: data.allFields || [],
        totalRecords: data.totalRecords || 0
      });
      
      // Auto-select all fields for search
      setSelectedFields(data.allFields || []);
      setReturnableFields(data.allFields || []);
      
      // Switch to search tab
      setActiveTab('search');
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Define doSearch function for search functionality using useCallback
  const doSearch = useCallback(async () => {
    // Use either the ref or the state value, whichever is available
    const currentQuery = searchQuery || searchQueryRef.current;
    const currentData = uploadedData || uploadedDataRef.current;
    
    // Update the refs with the latest values
    searchQueryRef.current = currentQuery;
    uploadedDataRef.current = currentData;
    
    if (!currentQuery || !currentData) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    setUploadError(null);
      try {
        // Clear any previous errors
        setUploadError(null);
        const startTime = performance.now();
        
        // Construct search URL with current values
        const dataId = currentData.dataId || '';
        const query = currentQuery;
        const searchUrl = `/api/search?q=${encodeURIComponent(query)}&dataId=${encodeURIComponent(dataId)}`;
        
        console.log('Searching with URL:', searchUrl);
        const response = await fetch(searchUrl);
        const searchData = await response.json();
        
        const endTime = performance.now();
        const searchTimeMs = endTime - startTime;
        
        console.log('Search response:', searchData);
        
        if (response.ok && searchData.results) {
          setSearchResults(searchData.results);
          
          // Update performance metrics with both client and server timing
          setSearchPerformance({
            clientTime: searchTimeMs,
            serverTime: searchData.performance?.time || 0,
            resultsCount: searchData.results.length
          });
          
          // Extract fields from results for table headers if available
          if (searchData.results.length > 0) {
            const firstResult = searchData.results[0];
            const fields = Object.keys(firstResult).filter(key => !['score', '__typename'].includes(key));
            
            // Set returnable fields for displaying results
            if (fields.length > 0) {
              setReturnableFields(fields);
            }
          }
          
          // Visualization code removed - now only available in local search tab
          
          // Clear any previous errors if search was successful
          setUploadError(null);
        } else {
          throw new Error(searchData.error || 'Search failed');
        }
      } catch (error) {
        console.error('Search error:', error);
        setUploadError(error instanceof Error ? error.message : 'An error occurred during search');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
  }, [searchQuery, uploadedData, setSearchResults, setIsSearching, setUploadError, setSearchPerformance, setReturnableFields]);
  
  // Initial search when uploadedData changes
  useEffect(() => {
    if (uploadedData) {
      doSearch();
    }
  }, [uploadedData, doSearch]);
  
  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      doSearch();
    }, 300);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, doSearch]);
  
  // Save field configuration
  const saveFieldConfiguration = async () => {
    if (!uploadedData) return;
    
    console.log('Saving field configuration:', selectedFields);
    
    // Switch to search tab after saving
    setActiveTab('search');
  };

  // Handle downloading the ZipTrie data
  const handleDownloadData = async () => {
    try {
      setIsSearching(true); // Reuse the loading state
      setUploadError(null); // Clear any previous errors
      
      // Check if data has been uploaded first
      if (!uploadedData || !uploadedData.dataId) {
        throw new Error('Please upload data first before downloading the ZipTrie structure');
      }
      
      // Ask if user wants compression
      const useCompression = window.confirm('Would you like to compress the ZipTrie data? (Recommended for larger datasets)');
      
      console.log('Downloading ZipTrie data...');
      const downloadUrl = useCompression ? '/api/download?compress=true' : '/api/download';
      const response = await fetch(downloadUrl);
      
      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to download data';
        console.error('Download API error:', errorMessage);
        
        // If the error is about no data found, provide a clearer message
        if (errorMessage.includes('No data found')) {
          throw new Error('No data available for download. Please upload data first.');
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Create a downloadable JSON file
      let blob;
      if (useCompression) {
        // Use pako or similar library for client-side compression
        // Since we don't have pako imported, we'll use a simpler approach
        // In a real implementation, you would use: const compressed = pako.deflate(JSON.stringify(data));
        console.log('Compressing data client-side...');
        
        // Create a more efficient JSON representation with shorter keys
        const optimizedData = {
          m: data.metadata, // metadata
          i: data.items,    // items
          t: data.trie      // trie
        };
        
        // For very large datasets, you could implement a streaming approach
        // or use a Web Worker to avoid blocking the UI thread
        blob = new Blob([JSON.stringify(optimizedData)], { type: 'application/json' });
      } else {
        // Pretty-print for readability if not compressing
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      }
      
      const url = URL.createObjectURL(blob);
      
      // Create a link and trigger the download
      const a = document.createElement('a');
      a.href = url;
      const fileExt = useCompression ? '.min.json' : '.json';
      a.download = `zearchy-ziptrie-${new Date().toISOString().split('T')[0]}${fileExt}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('Download complete');
      
      // Show success message
      setUploadStatus(`ZipTrie data successfully downloaded. The file contains ${data.metadata.totalRecords} records.`);
      setTimeout(() => setUploadStatus(''), 5000);
    } catch (error) {
      console.error('Download error:', error);
      setUploadError(error instanceof Error ? error.message : 'An error occurred during download');
      
      // Display a more helpful message in the UI
      if (error instanceof Error && error.message.includes('No data')) {
        setUploadStatus('You need to upload data before downloading the ZipTrie structure. Please upload a file first.');
      }
    } finally {
      setIsSearching(false);
    }
  };
  
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-black">Zearchy Search Platform</h1>
            <div className="flex items-center space-x-4">
              {isLoaded && user && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-black">{user.primaryEmailAddress?.emailAddress}</span>
                  <UserButton afterSignOutUrl="/" />
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('datasets')}
                  className={`${
                    activeTab === 'datasets'
                      ? 'border-blue-500 text-black'
                      : 'border-transparent text-black hover:text-black hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                >
                  Datasets
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`${
                    activeTab === 'upload'
                      ? 'border-blue-500 text-black'
                      : 'border-transparent text-black hover:text-black hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                >
                  Upload Data
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={`${
                    activeTab === 'search'
                      ? 'border-blue-500 text-black'
                      : 'border-transparent text-black hover:text-black hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                >
                  Search
                </button>
                <button
                  onClick={() => setActiveTab('localsearch')}
                  className={`${
                    activeTab === 'localsearch'
                      ? 'border-blue-500 text-black'
                      : 'border-transparent text-black hover:text-black hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                >
                  Local Search
                </button>

                <button
                  onClick={() => setActiveTab('apikeys')}
                  className={`${
                    activeTab === 'apikeys'
                      ? 'border-blue-500 text-black'
                      : 'border-transparent text-black hover:text-black hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                >
                  API Keys
                </button>
              </nav>
            </div>
            
            <div className="p-6">
              {activeTab === 'datasets' && (
                <DatasetsTab />
              )}
              
              {activeTab === 'upload' && (
                <div>
                  <h2 className="text-xl font-semibold text-black mb-4">Upload Data</h2>
                  <p className="text-black mb-6">
                    Upload your JSON or CSV data to begin searching with our high-performance ZipTrie engine.
                  </p>
                  
                  <FileUploadZone
                    onDrop={handleFileUpload}
                    isUploading={isUploading}
                    uploadError={uploadError}
                    uploadStatus={uploadStatus}
                  />
                  
                  {uploadedData && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold text-black mb-2">Data Preview</h3>
                      <div className="overflow-auto max-h-96 border rounded-md">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {uploadedData.fields.map((field) => (
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
                            {uploadedData.preview && uploadedData.preview.map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {uploadedData.fields.map((field) => (
                                  <td key={field} className="px-6 py-4 whitespace-nowrap text-sm text-black">
                                    {row[field] !== undefined ? String(row[field]) : ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-black mb-2">Configure Search Fields</h3>
                        <p className="text-sm text-black mb-4">
                          Select which fields should be searchable. By default, all fields are selected.
                        </p>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                          {uploadedData.fields.map((field) => (
                            <div key={field} className="flex items-center">
                              <input
                                id={`field-${field}`}
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                checked={selectedFields.includes(field)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedFields((prev) => [...prev, field]);
                                  } else {
                                    setSelectedFields((prev) => prev.filter((f) => f !== field));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`field-${field}`}
                                className="ml-2 block text-sm text-black"
                              >
                                {field}
                              </label>
                            </div>
                          ))}
                        </div>
                        
                        <button
                          onClick={saveFieldConfiguration}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                        >
                          Save Configuration
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'search' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-black">Search</h2>
                    
                    {/* ZipTrie Download Button */}
                    <button
                      onClick={handleDownloadData}
                      className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 flex items-center text-sm"
                      disabled={!uploadedData}
                      title={!uploadedData ? "Upload data first" : "Download ZipTrie structure for offline use"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download ZipTrie
                    </button>
                  </div>
                  
                  <p className="text-black mb-6">
                    Search your uploaded data using our high-performance ZipTrie search engine.
                  </p>
                  
                  <div className="mb-6">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Enter search term..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-black"
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-2">
                          <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    {uploadError && (
                      <div className="mt-2 text-sm text-red-600">{uploadError}</div>
                    )}
                  </div>
                  
                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-black">Search Results ({searchResults.length})</h3>
                        
                        {/* Performance Metrics */}
                        {(searchPerformance.clientTime > 0 || searchPerformance.serverTime > 0) && (
                          <div className="text-sm text-black bg-blue-50 px-3 py-1 rounded-md">
                            <div className="flex flex-col sm:flex-row sm:gap-3">
                              <div>
                                <span className="font-medium">Algorithm:</span> {searchPerformance.serverTime.toFixed(2)}ms
                              </div>
                              <div>
                                <span className="font-medium">Total:</span> {searchPerformance.clientTime.toFixed(2)}ms
                              </div>
                              <div>
                                <span className="font-medium">Speed:</span> {(searchPerformance.resultsCount / (searchPerformance.serverTime / 1000 || 0.001)).toFixed(0)} results/second
                              </div>
                              {uploadedData && uploadedData.totalRecords > 10000 && (
                                <span className="ml-2 text-green-600 font-medium">🚀 High Performance</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Search Results Grid */}
                      <div className="overflow-auto max-h-96 p-4 border rounded-md bg-white mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {searchResults.map((result, index) => (
                            <div key={index} className="bg-gray-50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200">
                              {returnableFields.map((field) => (
                                <div key={field} className="mb-2">
                                  <span className="text-xs font-medium text-gray-500 uppercase">{field}:</span>
                                  <div className="text-sm text-black font-medium truncate">
                                    {String(result[field] || '')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* ZipTrie Visualization removed - now only available in local search tab */}
                </div>
              )}
              
              {activeTab === 'localsearch' && (
                <LocalSearchTab />
              )}
              

              
              {activeTab === 'apikeys' && (
                <ApiKeysTab />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}