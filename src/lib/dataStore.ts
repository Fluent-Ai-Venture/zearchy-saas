import { ZipTrie } from './ziptrie';

// In-memory store for user data
export const userDataStore: Record<string, {
  dataId: string;
  trie: ZipTrie;
  rawData: Record<string, unknown>[];
  searchFields: string[];
  returnFields: string[];
  lastUpdated: Date;
  totalRecords: number;
}> = {};
