// Custom hook for parallel search using Web Workers
import { useState, useEffect, useRef } from 'react';
import { ZipTrie } from '@/lib/ziptrie';

type SearchResult = {
  data: Record<string, unknown>;
  score: number;
};

type SearchWorkerMessage = {
  type: 'SEARCH';
  query: string;
  limit: number;
  trieData?: unknown;
};

type SearchWorkerResponse = {
  type: 'SEARCH_RESULTS' | 'ERROR';
  results?: SearchResult[];
  error?: string;
  timeTaken?: number;
};

export function useParallelSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number>(0);
  const workerRef = useRef<Worker | null>(null);
  const trieRef = useRef<ZipTrie | null>(null);
  
  // Initialize the worker
  useEffect(() => {
    // Clean up function to terminate worker
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);
  
  // Function to initialize the trie with data
  const initializeTrie = (data: Record<string, unknown>[], fields: string[]) => {
    console.log(`Initializing trie with ${data.length} records and fields:`, fields);
    
    if (data.length === 0 || fields.length === 0) {
      console.warn('Cannot initialize trie with empty data or fields');
      return;
    }
    
    // Create a new ZipTrie instance
    const trie = new ZipTrie();
    
    // Use high-performance mode for large datasets
    const useHighPerformance = data.length > 10000;
    console.log(`Using ${useHighPerformance ? 'high-performance' : 'standard'} mode`);
    
    // Load the data into the trie
    const startTime = performance.now();
    trie.loadData(data, fields, false, useHighPerformance);
    const endTime = performance.now();
    
    console.log(`Trie initialized in ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
    
    // Store the trie for later use
    trieRef.current = trie;
    
    return trie;
  };
  
  // Function to search using Web Workers for parallel processing
  const search = async (query: string, limit: number = 10): Promise<SearchResult[]> => {
    if (!query.trim()) {
      setResults([]);
      return [];
    }
    
    setIsSearching(true);
    setError(null);
    
    try {
      // Check if we have a trie
      if (!trieRef.current) {
        throw new Error('Trie not initialized. Call initializeTrie first.');
      }
      
      const startTime = performance.now();
      let searchResults: SearchResult[] = [];
      
      // Check if Web Workers are supported
      if (typeof Worker === 'undefined') {
        console.log('Web Workers not supported, using main thread for search');
        
        // Use the main thread if workers aren't supported
        searchResults = trieRef.current.search(query, limit, true); // Use high-performance mode
      } else {
        console.log('Using Web Worker for parallel search');
        
        // Create a new worker or reuse existing one
        if (!workerRef.current) {
          workerRef.current = new Worker(new URL('../workers/search-worker.ts', import.meta.url), {
            type: 'module'
          });
        }
        
        // Create a promise to handle the worker response
        const workerPromise = new Promise<SearchResult[]>((resolve, reject) => {
          if (!workerRef.current) {
            reject(new Error('Worker initialization failed'));
            return;
          }
          
          // Set up message handler
          const messageHandler = (event: MessageEvent<SearchWorkerResponse>) => {
            const { type, results, error, timeTaken } = event.data;
            
            if (type === 'SEARCH_RESULTS') {
              if (timeTaken) {
                console.log(`Worker search completed in ${timeTaken.toFixed(2)}ms`);
              }
              resolve(results || []);
            } else if (type === 'ERROR') {
              reject(new Error(error || 'Unknown error in worker'));
            }
            
            // Remove the message handler after receiving a response
            workerRef.current?.removeEventListener('message', messageHandler);
          };
          
          // Add message handler
          workerRef.current.addEventListener('message', messageHandler);
          
          // Send the search request to the worker
          workerRef.current.postMessage({
            type: 'SEARCH',
            query,
            limit,
            trieData: trieRef.current
          } as SearchWorkerMessage);
        });
        
        // Wait for the worker to complete
        searchResults = await workerPromise;
      }
      
      const endTime = performance.now();
      const timeTaken = endTime - startTime;
      
      console.log(`Search for "${query}" completed in ${timeTaken.toFixed(2)}ms with ${searchResults.length} results`);
      setSearchTime(timeTaken);
      setResults(searchResults);
      setIsSearching(false);
      
      return searchResults;
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'Unknown search error');
      setIsSearching(false);
      return [];
    }
  };
  
  return {
    initializeTrie,
    search,
    results,
    isSearching,
    error,
    searchTime
  };
}
