// src/lib/indexedDbStorage.ts
import pako from 'pako';

const DB_NAME = 'ZipTrieStorage';
const STORE_NAME = 'datasets';
const DB_VERSION = 1;

/**
 * Compresses data using pako
 */
export const compressData = (data: string): Uint8Array => {
  return pako.deflate(data);
};

/**
 * Decompresses data using pako
 */
export const decompressData = (data: Uint8Array): string => {
  const decompressed = pako.inflate(data);
  return new TextDecoder().decode(decompressed);
};

/**
 * Opens a connection to the IndexedDB
 */
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event);
      reject(new Error('Failed to open IndexedDB'));
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Stores data in IndexedDB with compression
 */
export const storeData = async (key: string, data: string): Promise<boolean> => {
  try {
    // Compress the data
    const compressedData = compressData(data);
    
    // Open the database
    const db = await openDatabase();
    
    // Store the data
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.put({
        id: key,
        data: compressedData,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error storing data in IndexedDB:', event);
        reject(new Error('Failed to store data in IndexedDB'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error in storeData:', error);
    return false;
  }
};

/**
 * Retrieves data from IndexedDB with decompression
 */
export const retrieveData = async (key: string): Promise<string | null> => {
  try {
    // Open the database
    const db = await openDatabase();
    
    // Retrieve the data
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          try {
            const decompressed = decompressData(result.data);
            resolve(decompressed);
          } catch (error) {
            console.error('Error decompressing data:', error);
            reject(new Error('Failed to decompress data'));
          }
        } else {
          resolve(null);
        }
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving data from IndexedDB:', event);
        reject(new Error('Failed to retrieve data from IndexedDB'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error in retrieveData:', error);
    return null;
  }
};

/**
 * Removes data from IndexedDB
 */
export const removeData = async (key: string): Promise<boolean> => {
  try {
    // Open the database
    const db = await openDatabase();
    
    // Remove the data
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(key);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error removing data from IndexedDB:', event);
        reject(new Error('Failed to remove data from IndexedDB'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error in removeData:', error);
    return false;
  }
};

/**
 * Lists all keys in the IndexedDB store
 */
export const listKeys = async (): Promise<string[]> => {
  try {
    // Open the database
    const db = await openDatabase();
    
    // List all keys
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.getAllKeys();
      
      request.onsuccess = () => {
        const keys = request.result as string[];
        resolve(keys);
      };
      
      request.onerror = (event) => {
        console.error('Error listing keys from IndexedDB:', event);
        reject(new Error('Failed to list keys from IndexedDB'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error in listKeys:', error);
    return [];
  }
};

/**
 * Checks if IndexedDB is supported in the current browser
 */
export const isIndexedDBSupported = (): boolean => {
  return typeof window !== 'undefined' && 'indexedDB' in window;
};
