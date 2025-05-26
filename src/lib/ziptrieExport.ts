// src/lib/ziptrieExport.ts
import { ZipTrie, ZipTrieNode } from './ziptrie';

// Define the serializable trie structure
export interface SerializedTrieNode {
  char: string;
  isEndOfWord: boolean;
  itemIds: string[];
  children: Record<string, SerializedTrieNode>;
}

/**
 * Extended ZipTrie class with export/import functionality
 * This allows us to serialize the trie for storage and transmission
 */
export class ExportableZipTrie extends ZipTrie {
  /**
   * Export the trie to a JSON-serializable format
   * This only exports the structure and item IDs, not the full items
   */
  export(): SerializedTrieNode {
    return this.exportNode(this.getRoot());
  }

  /**
   * Get access to the root node (protected method in base class)
   */
  private getRoot(): ZipTrieNode {
    // @ts-expect-error - accessing protected property
    return this.root;
  }

  /**
   * Export a node to a serializable format
   */
  private exportNode(node: ZipTrieNode): SerializedTrieNode {
    const result: SerializedTrieNode = {
      char: node.char,
      isEndOfWord: node.isEndOfWord,
      // Only store item IDs at terminal nodes, not full objects
      itemIds: node.isEndOfWord ? node.items.map(item => this.getItemIdFromItem(item)) : [],
      children: {}
    };

    // Export all children
    for (const [char, childNode] of node.children.entries()) {
      result.children[char] = this.exportNode(childNode);
    }

    return result;
  }

  /**
   * Import a previously exported trie
   * @param exportedTrie The exported trie structure
   * @param itemsMap A map of item IDs to their full objects
   */
  static import(exportedTrie: SerializedTrieNode, itemsMap: Record<string, Record<string, unknown>>): ExportableZipTrie {
    const trie = new ExportableZipTrie();
    
    // Clear the trie first
    trie.clear();
    
    // Import the structure
    this.importNode(trie.getRoot(), exportedTrie, itemsMap);
    
    return trie;
  }

  /**
   * Import a node from a serialized format
   */
  private static importNode(
    targetNode: ZipTrieNode, 
    sourceNode: SerializedTrieNode, 
    itemsMap: Record<string, Record<string, unknown>>
  ): void {
    // Set basic properties
    targetNode.char = sourceNode.char;
    targetNode.isEndOfWord = sourceNode.isEndOfWord;
    
    // Add items if this is an end of word
    if (sourceNode.isEndOfWord && Array.isArray(sourceNode.itemIds)) {
      targetNode.items = sourceNode.itemIds
        .map((id: string) => itemsMap[id])
        .filter((item: Record<string, unknown> | undefined) => item !== undefined);
    }
    
    // Import all children
    for (const char in sourceNode.children) {
      if (Object.prototype.hasOwnProperty.call(sourceNode.children, char)) {
        const childData = sourceNode.children[char];
        // Create a new node for this child
        const childNode = {
          char,
          children: new Map<string, ZipTrieNode>(),
          isEndOfWord: false,
          items: []
        };
        
        // Import the child node recursively
        this.importNode(childNode, childData, itemsMap);
        
        // Add the child to the parent
        targetNode.children.set(char, childNode);
      }
    }
  }

  /**
   * Get a unique identifier for an item - making this public for export functionality
   * Renamed to avoid conflict with the private method in the parent class
   */
  getItemIdFromItem(item: Record<string, unknown>): string {
    // Use ID fields if available
    if (item.id) return String(item.id);
    if (item.Id) return String(item.Id);
    if (item.ID) return String(item.ID);
    if (item.OrganizationId) return String(item.OrganizationId);
    if (item.Index) return String(item.Index);

    // Fallback to using the whole object
    return JSON.stringify(item);
  }
}

/**
 * Create a new ExportableZipTrie instance with data loaded
 */
export function createExportableZipTrie(
  data: Record<string, unknown>[], 
  searchFields: string[]
): ExportableZipTrie {
  const trie = new ExportableZipTrie();
  trie.loadData(data, searchFields);
  return trie;
}
