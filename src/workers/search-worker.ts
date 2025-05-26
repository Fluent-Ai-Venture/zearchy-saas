// Search Worker
// This worker handles search operations in a separate thread for better performance

import { ZipTrie } from '@/lib/ziptrie';

// Define message types for communication with the main thread
type WorkerMessage = {
  type: 'SEARCH';
  query: string;
  limit: number;
  trieData?: unknown; // Serialized trie data
};

type WorkerResponse = {
  type: 'SEARCH_RESULTS' | 'ERROR';
  results?: Array<{
    data: Record<string, unknown>;
    score: number;
  }>;
  error?: string;
  timeTaken?: number;
};

// Initialize variables
let trie: ZipTrie | null = null;

// Listen for messages from the main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, query, limit, trieData } = event.data;

  try {
    if (type === 'SEARCH') {
      const startTime = performance.now();
      
      // If we received trie data, initialize the trie
      if (trieData) {
        trie = new ZipTrie();
        // Deserialize the trie data
        Object.assign(trie, trieData);
      }
      
      if (!trie) {
        throw new Error('Trie not initialized');
      }
      
      // Perform the search in the worker thread
      const results = trie.search(query, limit, true); // true for high-performance mode
      
      const endTime = performance.now();
      const timeTaken = endTime - startTime;
      
      // Send the results back to the main thread
      self.postMessage({
        type: 'SEARCH_RESULTS',
        results,
        timeTaken
      } as WorkerResponse);
    }
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error in worker'
    } as WorkerResponse);
  }
});

// Export empty object to satisfy TypeScript module requirements
export {};
