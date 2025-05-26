// src/hooks/useLocalZipTrie.ts
import { useState, useEffect, useCallback } from 'react';
import { ExportableZipTrie, SerializedTrieNode } from '@/lib/ziptrieExport';
import pako from 'pako';
import {
  storeData,
  retrieveData,
  removeData,
  isIndexedDBSupported
} from '@/lib/indexedDbStorage';

// Compression using pako
const compress = (data: string): string => {
  try {
    // Use pako for compression
    const compressed = pako.deflate(data);
    // Convert to base64 for localStorage fallback
    return btoa(String.fromCharCode.apply(null, compressed as unknown as number[]));
  } catch (e) {
    console.warn('Compression failed, storing uncompressed data', e);
    return `uncompressed:${data}`;
  }
};

const decompress = (data: string): string => {
  try {
    // Check if the data is uncompressed
    if (data.startsWith('uncompressed:')) {
      return data.substring('uncompressed:'.length);
    }
    
    // Decompress using pako
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decompressed = pako.inflate(bytes);
    return new TextDecoder().decode(decompressed);
  } catch (e) {
    console.warn('Decompression failed, assuming uncompressed data', e);
    return data;
  }
};

// Helper to safely store data with fallbacks between IndexedDB and localStorage
const safelyStoreData = async (key: string, data: string): Promise<boolean> => {
  // Try IndexedDB first if supported
  if (isIndexedDBSupported()) {
    try {
      const success = await storeData(key, data);
      if (success) {
        // Successfully stored in IndexedDB
        console.log(`Data stored in IndexedDB for key ${key}`);
        
        // Store a reference in localStorage to indicate data is in IndexedDB
        try {
          localStorage.setItem(key, JSON.stringify({ storedInIndexedDB: true, datasetId: key.split(':')[1] }));
        } catch (localStorageError) {
          // Not critical if this fails
          console.warn('Could not store IndexedDB reference in localStorage', localStorageError);
        }
        
        return true;
      }
    } catch (indexedDBError) {
      console.warn('Failed to store in IndexedDB, falling back to localStorage', indexedDBError);
      // Fall back to localStorage
    }
  }
  
  // Fall back to localStorage if IndexedDB is not supported or failed
  try {
    // Try to store the data directly in localStorage
    localStorage.setItem(key, data);
    return true;
  } catch (e) {
    if (e instanceof DOMException && (
        e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      
      console.warn('localStorage quota exceeded, trying to free up space');
      
      // Try to free up space by removing other ZipTrie data
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith('ziptrie:') && storageKey !== key) {
          keysToRemove.push(storageKey);
        }
      }
      
      // Remove oldest items first (we don't have timestamps, so just remove in order)
      for (const keyToRemove of keysToRemove) {
        localStorage.removeItem(keyToRemove);
        console.log(`Removed ${keyToRemove} to free up space`);
        
        // Try storing again
        try {
          localStorage.setItem(key, data);
          return true;
        } catch {
          // Continue to the next item if still not enough space
          // Ignore the error
        }
      }
      
      // If we've removed all other items and still can't store, try to store a reference instead
      try {
        // Store just a reference indicating the data is too large for localStorage
        localStorage.setItem(key, JSON.stringify({ tooLargeForStorage: true, datasetId: key.split(':')[1] }));
        return false;
      } catch (finalError) {
        console.error('Failed to store even a reference in localStorage', finalError);
        return false;
      }
    } else {
      console.error('Error storing data in localStorage', e);
      return false;
    }
  }
};

type ZipTrieData = {
  trie: SerializedTrieNode;
  items: Record<string, Record<string, unknown>>;
  datasetId: string;
  datasetName: string;
  totalItems: number;
};

/**
 * Hook for managing ZipTrie data with local caching support
 * This allows the application to work offline after the initial data load
 */
export function useLocalZipTrie(datasetId?: string) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [trieData, setTrieData] = useState<ZipTrieData | null>(null);
  const [zipTrie, setZipTrie] = useState<ExportableZipTrie | null>(null);
  
  // Load ZipTrie data from server or local cache
  const loadTrieData = useCallback(async (forceRefresh = false) => {
    if (!datasetId) {
      setError('No dataset ID provided');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const storageKey = `ziptrie:${datasetId}`;
      
      // Skip cache if forcing refresh
      if (!forceRefresh) {
        // Try IndexedDB first if supported
        if (isIndexedDBSupported()) {
          try {
            const indexedDbData = await retrieveData(storageKey);
            if (indexedDbData) {
              try {
                // Parse the data from IndexedDB
                const parsedData = JSON.parse(indexedDbData) as ZipTrieData;
                setTrieData(parsedData);
                
                // Initialize the ZipTrie from the cached data
                const importedTrie = ExportableZipTrie.import(parsedData.trie, parsedData.items);
                setZipTrie(importedTrie);
                
                console.log(`Loaded ZipTrie from IndexedDB for dataset ${datasetId}`);
                setLoading(false);
                return;
              } catch (parseError) {
                console.warn('Error parsing IndexedDB data, will try localStorage or server', parseError);
              }
            }
          } catch (indexedDbError) {
            console.warn('Error retrieving from IndexedDB, will try localStorage or server', indexedDbError);
          }
        }
        
        // Fall back to localStorage if IndexedDB is not supported or failed
        const cachedData = localStorage.getItem(storageKey);
        if (cachedData) {
          try {
            // Try to parse the cached data
            const parsedData = JSON.parse(cachedData);
            
            // Check if this is a reference to data in IndexedDB
            if ('storedInIndexedDB' in parsedData && parsedData.storedInIndexedDB) {
              console.log('Reference found in localStorage, but actual data should be in IndexedDB');
              // We already tried IndexedDB above and it failed, so continue to server fetch
            }
            // Check if this is a reference to data that was too large
            else if ('tooLargeForStorage' in parsedData && parsedData.tooLargeForStorage) {
              console.log('Data was too large for localStorage, fetching from server');
              // Continue to server fetch below
            } 
            // It's valid data directly in localStorage
            else {
              try {
                const decompressedData = decompress(cachedData);
                const parsedData = JSON.parse(decompressedData) as ZipTrieData;
                
                setTrieData(parsedData);
                
                // Initialize the ZipTrie from the cached data
                const importedTrie = ExportableZipTrie.import(parsedData.trie, parsedData.items);
                setZipTrie(importedTrie);
                
                console.log(`Loaded ZipTrie from localStorage for dataset ${datasetId}`);
                setLoading(false);
                return;
              } catch (decompressError) {
                console.warn('Error decompressing localStorage data', decompressError);
                // Continue to server fetch below
              }
            }
          } catch (parseError) {
            console.warn('Error parsing localStorage data, fetching from server', parseError);
            // Continue to server fetch below
          }
        }
      }
      
      // Fetch from server if not in cache, forcing refresh, or cache was invalid
      const response = await fetch(`/api/trie/${datasetId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch trie data');
      }
      
      const data = await response.json() as ZipTrieData;
      
      // Set the data in state
      setTrieData(data);
      
      // Log the received data for debugging
      console.log('Received trie data from server');
      console.log('Trie structure type:', typeof data.trie);
      console.log('Items count:', Object.keys(data.items).length);
      
      // Try to save to storage for offline use
      try {
        const serializedData = JSON.stringify(data);
        // Compress the data before storing
        const compressedData = compress(serializedData);
        
        // Try to store in available storage
        const stored = await safelyStoreData(storageKey, compressedData);
        if (!stored) {
          console.warn('Data was too large to store in available storage, offline functionality may be limited');
          setError('Dataset is too large for complete offline use. Some features may be limited when offline.');
        }
      } catch (storageError) {
        console.error('Error storing data:', storageError);
        // Non-critical error, we can still use the data we fetched
      }
      
      try {
        // Initialize the ZipTrie
        const importedTrie = ExportableZipTrie.import(data.trie, data.items);
        setZipTrie(importedTrie);
        console.log('Successfully imported trie data');
      } catch (importError) {
        console.error('Error importing trie data:', importError);
        setError(`Failed to initialize search index: ${importError instanceof Error ? importError.message : String(importError)}`);
      }
      
      console.log(`Loaded ZipTrie from server for dataset ${datasetId}`);
    } catch (err) {
      console.error('Error loading ZipTrie data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error loading ZipTrie data');
    } finally {
      setLoading(false);
    }
  }, [datasetId]);
  
  // Clear the cache for a specific dataset
  const clearCache = useCallback(async () => {
    if (!datasetId) return;
    
    const storageKey = `ziptrie:${datasetId}`;
    
    // Clear from localStorage
    localStorage.removeItem(storageKey);
    
    // Clear from IndexedDB if supported
    if (isIndexedDBSupported()) {
      try {
        await removeData(storageKey);
        console.log(`Removed data from IndexedDB for dataset ${datasetId}`);
      } catch (error) {
        console.warn(`Failed to remove data from IndexedDB for dataset ${datasetId}`, error);
      }
    }
    
    // Reset state
    setTrieData(null);
    setZipTrie(null);
    console.log(`Cleared cache for dataset ${datasetId}`);
  }, [datasetId]);
  
  // Perform a search using the local ZipTrie
  const search = useCallback((query: string, limit: number = 10) => {
    if (!zipTrie) {
      console.warn('Search attempted but ZipTrie is not initialized');
      return [];
    }
    
    try {
      console.log(`Executing search for "${query}" with limit ${limit}`);
      
      // Ensure the search method exists
      if (typeof zipTrie.search !== 'function') {
        console.error('ZipTrie search method is not a function:', zipTrie);
        return [];
      }
      
      // Execute the search
      const results = zipTrie.search(query, limit);
      console.log(`Search returned ${results.length} results`);
      
      // Format the results to ensure they have the expected structure
      return results.map(result => {
        // If the result is already in the expected format, return it as is
        if (result && typeof result === 'object' && 'data' in result) {
          return result;
        }
        
        // Otherwise, wrap it in the expected format
        return { data: result, score: 1.0 };
      });
    } catch (error) {
      console.error('Error during search:', error);
      return [];
    }
  }, [zipTrie]);
  
  // Load data on mount or when datasetId changes
  useEffect(() => {
    if (datasetId) {
      loadTrieData();
    }
  }, [datasetId, loadTrieData]);
  
  return {
    loading,
    error,
    trieData,
    zipTrie,
    search,
    loadTrieData,
    clearCache,
    isOffline: !!trieData && !navigator.onLine
  };
}
