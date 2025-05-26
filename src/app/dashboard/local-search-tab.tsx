// src/app/dashboard/local-search-tab.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLocalZipTrie } from '@/hooks/useLocalZipTrie';
import { useSearchParams } from 'next/navigation';
import TrieVisualizer from '@/components/TrieVisualizer';
import { TrieVisualizationNode } from '@/lib/ziptrie';

export default function LocalSearchTab() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get('datasetId');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ data: Record<string, unknown>; score: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [returnableFields, setReturnableFields] = useState<string[]>([]);
  const [visualizationData, setVisualizationData] = useState<TrieVisualizationNode | null>(null);
  const [searchPath, setSearchPath] = useState<TrieVisualizationNode[] | null>(null);
  
  const {
    loading,
    error,
    trieData,
    // Not using the search function since we implemented our own direct search
    // search,
    loadTrieData,
    clearCache,
    isOffline
  } = useLocalZipTrie(datasetId || undefined);
  
  // Generate visualization data for the entire trie
  const generateVisualizationData = useCallback((query: string = '') => {
    if (!trieData || !trieData.items) {
      setVisualizationData(null);
      setSearchPath(null);
      return;
    }

    try {
      // Create a simplified visualization tree for the entire trie
      const rootNode: TrieVisualizationNode = {
        char: '',
        isEndOfWord: false,
        itemCount: Object.keys(trieData.items).length,
        children: []
      };

      // No need to track all path nodes anymore since we're building the full trie
      const processedValues = new Set<string>(); // Track processed values to avoid duplicates
      
      // Build the complete trie structure from all items
      for (const itemId in trieData.items) {
        const item = trieData.items[itemId];
        
        // Process each field in the item
        for (const field in item) {
          const value = String(item[field] || '').toLowerCase();
          
          // Skip empty values or already processed ones
          if (!value || processedValues.has(`${field}:${value}`)) continue;
          processedValues.add(`${field}:${value}`);
          
          // Process each character in the value
          let currentNode = rootNode;
          
          for (let i = 0; i < value.length; i++) {
            const char = value[i];
            let childNode = currentNode.children.find(child => child.char === char);
            
            if (!childNode) {
              childNode = {
                char: char,
                isEndOfWord: i === value.length - 1,
                itemCount: i === value.length - 1 ? 1 : 0,
                children: []
              };
              currentNode.children.push(childNode);
            } else if (i === value.length - 1) {
              // If this is the end of a word, mark it and increment count
              childNode.isEndOfWord = true;
              childNode.itemCount += 1;
            }
            
            currentNode = childNode;
          }
        }
      }
      
      // Sort children alphabetically for better visualization
      const sortChildrenRecursively = (node: TrieVisualizationNode) => {
        if (node.children.length > 0) {
          node.children.sort((a, b) => a.char.localeCompare(b.char));
          node.children.forEach(sortChildrenRecursively);
        }
      };
      
      sortChildrenRecursively(rootNode);
      
      // If there's a search query, identify the search path
      if (query) {
        const searchPathNodes: TrieVisualizationNode[] = [rootNode];
        let currentNode = rootNode;
        let validPath = true;
        
        // Find the path for the current query
        for (let i = 0; i < query.length && validPath; i++) {
          const char = query[i].toLowerCase();
          const childNode = currentNode.children.find(child => child.char === char);
          
          if (childNode) {
            currentNode = childNode;
            searchPathNodes.push(childNode);
          } else {
            validPath = false;
          }
        }
        
        if (validPath) {
          setSearchPath(searchPathNodes);
        } else {
          setSearchPath([rootNode]); // Just highlight the root if path not found
        }
      } else {
        setSearchPath([rootNode]); // Just highlight the root if no query
      }
      
      setVisualizationData(rootNode);
    } catch (err) {
      console.error('Error generating visualization data:', err);
      setVisualizationData(null);
      setSearchPath(null);
    }
  }, [trieData]);

  // Determine which fields to display in results and generate initial visualization
  useEffect(() => {
    if (trieData && trieData.items && Object.keys(trieData.items).length > 0) {
      // Get the first item to extract fields
      const firstItemId = Object.keys(trieData.items)[0];
      const firstItem = trieData.items[firstItemId];
      if (firstItem) {
        setReturnableFields(Object.keys(firstItem));
      }
      
      // Generate the initial visualization of the full trie
      generateVisualizationData();
    }
  }, [trieData, generateVisualizationData]);
  
  // Perform search when query changes
  const performSearch = useCallback(() => {
    if (!searchQuery.trim() || !trieData || !trieData.items) {
      setSearchResults([]);
      return;
    }
    
    // Generate visualization data for the entire trie
    generateVisualizationData(searchQuery.trim());
    
    setIsSearching(true);
    const startTime = performance.now();
    
    try {
      // Log search attempt for debugging
      console.log(`Performing direct search for: "${searchQuery}"`);
      console.log('ZipTrie data loaded:', !!trieData);
      console.log('Items available:', Object.keys(trieData.items).length);
      
      // Perform a direct search on the items
      const query = searchQuery.toLowerCase().trim();
      const results = [];
      
      // Search through all items directly
      for (const itemId in trieData.items) {
        const item = trieData.items[itemId];
        let matched = false;
        let score = 0;
        
        // Check each field in the item
        for (const field in item) {
          const value = String(item[field] || '').toLowerCase();
          
          // Check for exact match
          if (value === query) {
            matched = true;
            score = 1.0;
            break;
          }
          
          // Check for starts with
          if (value.startsWith(query)) {
            matched = true;
            score = 0.9;
            break;
          }
          
          // Check for contains
          if (value.includes(query)) {
            matched = true;
            score = 0.8;
            break;
          }
        }
        
        if (matched) {
          results.push({
            data: item,
            score: score
          });
        }
      }
      
      // Sort results by score
      results.sort((a, b) => b.score - a.score);
      
      // Limit to 20 results
      const limitedResults = results.slice(0, 20);
      console.log(`Direct search returned ${limitedResults.length} results`);
      
      // Log a sample result if available
      if (limitedResults.length > 0) {
        console.log('Sample result:', limitedResults[0]);
      }
      
      setSearchResults(limitedResults);
      
      // Generate visualization data
      if (query && trieData) {
        generateVisualizationData(query);
      }
      
      // Calculate search time
      const endTime = performance.now();
      setSearchTime(endTime - startTime);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, trieData, generateVisualizationData]);



  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);
  
  if (!datasetId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded relative" role="alert">
        <p>Please select a dataset from the Datasets tab to start searching.</p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-gray-700">Loading dataset...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error:</strong>
        <span className="block sm:inline"> {error}</span>
        <button 
          onClick={() => loadTrieData(true)}
          className="mt-3 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-black">
          Search: {trieData?.datasetName || 'Dataset'}
          {isOffline && <span className="ml-2 text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Offline Mode</span>}
        </h2>
        <div className="flex space-x-3">
          <button 
            onClick={() => loadTrieData(true)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
          >
            Refresh Data
          </button>
          <button 
            onClick={() => clearCache()}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
          >
            Clear Cache
          </button>
        </div>
      </div>
      
      {/* Search instructions */}
      <div className="mb-2">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Start typing in the search box below</strong> to instantly search through your data using the ZipTrie algorithm.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Search input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Start typing to search..."
          className="w-full pl-10 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-black"
        />
        {isSearching && (
          <div className="absolute right-3 top-2">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      
      {/* Search stats */}
      {searchResults.length > 0 && (
        <div className="text-sm text-gray-500">
          Found {searchResults.length} results in {searchTime.toFixed(2)}ms
        </div>
      )}
      
      {/* Search results */}
      {searchResults.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchResults.map((result, index) => (
            <div 
              key={index} 
              className="bg-white border border-gray-200 rounded-md p-4 hover:shadow-md transition-shadow duration-200"
            >
              {returnableFields.map((field) => (
                <div key={field} className="mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase">{field}:</span>
                  <div className="text-sm text-black font-medium truncate">
                    {String(result.data[field] || '')}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : searchQuery.trim() ? (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
          <p className="text-gray-500">No results found for &quot;{searchQuery}&quot;</p>
        </div>
      ) : null}
      
      {/* Dataset info */}
      {trieData && (
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="font-medium text-gray-700">Dataset Information</h3>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="text-sm font-medium text-black">{trieData.datasetName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Items</p>
              <p className="text-sm font-medium text-black">{trieData.totalItems.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Storage</p>
              <p className="text-sm font-medium text-black">
                {isOffline ? 'Local Cache' : 'Server + Local Cache'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Dataset ID</p>
              <p className="text-sm font-medium text-black truncate">{trieData.datasetId}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* ZipTrie Visualization */}
      <div className="mt-8">
        <h3 className="font-medium text-gray-700 mb-2">Search Visualization</h3>
        {visualizationData && (
          <TrieVisualizer 
            treeData={visualizationData} 
            searchPath={searchPath} 
            searchQuery={searchQuery} 
          />
        )}
        {!visualizationData && searchQuery && !isSearching && (
          <div className="bg-gray-50 p-4 rounded-md text-black text-base border border-gray-200">
            No visualization data available for this search.
          </div>
        )}
      </div>
    </div>
  );
}
