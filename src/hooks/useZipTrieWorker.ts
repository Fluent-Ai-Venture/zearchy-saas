// Custom hook for using ZipTrie Web Worker
import { useState, useEffect, useRef } from 'react';
import { ZipTrie } from '@/lib/ziptrie';

// Define the batch size for processing
const BATCH_SIZE = 10000;

// Types for worker messages
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
  trie?: unknown;
  error?: string;
};

export function useZipTrieWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const workerRef = useRef<Worker | null>(null);
  
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
  
  // Function to process data with the worker
  const processData = async (data: Record<string, unknown>[], fields: string[]): Promise<ZipTrie> => {
    return new Promise((resolve, reject) => {
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      setStatusMessage('Initializing ZipTrie processing...');
      
      try {
        // Check if Web Workers are supported
        if (typeof Worker === 'undefined') {
          setStatusMessage('Web Workers not supported in this browser. Processing on main thread...');
          
          // Process on main thread if workers aren't supported
          const trie = new ZipTrie();
          const totalBatches = Math.ceil(data.length / BATCH_SIZE);
          
          // Process in batches to avoid UI freezing
          const processBatch = (batchIndex: number) => {
            if (batchIndex >= totalBatches) {
              setIsProcessing(false);
              setProgress(100);
              setStatusMessage('Processing complete!');
              resolve(trie);
              return;
            }
            
            const start = batchIndex * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, data.length);
            const batchData = data.slice(start, end);
            
            // Update progress
            const currentProgress = Math.round((batchIndex / totalBatches) * 100);
            setProgress(currentProgress);
            setStatusMessage(`Processing batch ${batchIndex + 1} of ${totalBatches}...`);
            
            // Process the batch
            setTimeout(() => {
              try {
                trie.loadData(batchData, fields, batchIndex > 0);
                processBatch(batchIndex + 1);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
                setIsProcessing(false);
                reject(err);
              }
            }, 0);
          };
          
          // Start processing
          processBatch(0);
        } else {
          // Use Web Worker for parallel processing
          setStatusMessage('Using Web Worker for parallel processing...');
          
          // Create a new worker
          if (workerRef.current) {
            workerRef.current.terminate();
          }
          
          workerRef.current = new Worker(new URL('../workers/ziptrie-worker.ts', import.meta.url), {
            type: 'module'
          });
          
          // Listen for messages from the worker
          workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const { type, message, progress: workerProgress, trie, error: workerError } = event.data;
            
            if (type === 'PROGRESS') {
              if (workerProgress !== undefined) {
                setProgress(workerProgress);
              }
              if (message) {
                setStatusMessage(message);
              }
            } else if (type === 'COMPLETE') {
              setIsProcessing(false);
              setProgress(100);
              setStatusMessage('Processing complete!');
              
              // Create a new ZipTrie from the serialized data
              const newTrie = new ZipTrie();
              Object.assign(newTrie, trie);
              resolve(newTrie);
            } else if (type === 'ERROR') {
              setIsProcessing(false);
              setError(workerError || 'Unknown error in worker');
              reject(new Error(workerError || 'Unknown error in worker'));
            }
          };
          
          // Handle worker errors
          workerRef.current.onerror = (err) => {
            setIsProcessing(false);
            setError(`Worker error: ${err.message}`);
            reject(err);
          };
          
          // Split data into batches for the worker
          const totalBatches = Math.ceil(data.length / BATCH_SIZE);
          
          // Process in batches
          for (let i = 0; i < totalBatches; i++) {
            const start = i * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, data.length);
            const batchData = data.slice(start, end);
            
            // Send batch to worker
            workerRef.current.postMessage({
              type: 'LOAD_DATA',
              data: batchData,
              fields,
              batchIndex: i,
              totalBatches
            } as WorkerMessage);
          }
        }
      } catch (err) {
        setIsProcessing(false);
        setError(err instanceof Error ? err.message : 'Unknown error');
        reject(err);
      }
    });
  };
  
  return {
    processData,
    isProcessing,
    progress,
    error,
    statusMessage
  };
}
