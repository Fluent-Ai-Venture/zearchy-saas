// ZipTrie Worker
// This worker handles the heavy processing of building the ZipTrie in a separate thread

import { ZipTrie } from '@/lib/ziptrie';

// Define message types for communication with the main thread
type WorkerMessage = {
  type: 'LOAD_DATA';
  data: Record<string, unknown>[];
  fields: string[];
  batchIndex?: number;
  totalBatches?: number;
};

type WorkerResponse = {
  type: 'PROGRESS' | 'COMPLETE' | 'ERROR';
  message?: string;
  progress?: number;
  trie?: unknown; // We'll serialize the trie for transfer
  error?: string;
};

// Initialize the ZipTrie
let trie = new ZipTrie();

// Listen for messages from the main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, data, fields, batchIndex, totalBatches } = event.data;

  try {
    if (type === 'LOAD_DATA') {
      console.time('workerProcessing');
      
      // Report progress
      self.postMessage({
        type: 'PROGRESS',
        message: `Processing batch ${batchIndex || 1} of ${totalBatches || 1}...`,
        progress: batchIndex ? (batchIndex / totalBatches!) * 100 : 0
      } as WorkerResponse);
      
      // Process the data in the worker thread
      console.log(`Worker processing ${data.length} records with fields:`, fields);
      
      // If this is the first batch, create a new trie
      if (!batchIndex || batchIndex === 0) {
        trie = new ZipTrie();
      }
      
      // Load the data into the trie
      trie.loadData(data, fields, batchIndex !== undefined && batchIndex > 0);
      
      console.timeEnd('workerProcessing');
      
      // Send the processed trie back to the main thread
      // Note: This is a simplified approach - for very large tries, 
      // we might need a more sophisticated serialization approach
      self.postMessage({
        type: 'COMPLETE',
        message: 'ZipTrie processing complete',
        progress: 100,
        trie: trie
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
