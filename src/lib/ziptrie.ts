// src/lib/ziptrie.ts
/**
 * ZipTrie - A simplified prefix tree for fast in-memory search
 * 
 * This implementation focuses on reliability and simplicity to ensure
 * search results are always returned correctly.
 */

// Define the structure of a node in our trie
export interface ZipTrieNode {
  char: string;
  children: Map<string, ZipTrieNode>;
  isEndOfWord: boolean;
  items: Array<Record<string, unknown>>;
}

// Define a type for the tree visualization
export type TrieVisualizationNode = {
  char: string;
  isEndOfWord: boolean;
  itemCount: number;
  children: TrieVisualizationNode[];
};

export class ZipTrie {
  private root: ZipTrieNode;
  private allItems: Record<string, unknown>[];
  private searchableFields: string[];

  constructor() {
    this.root = this.createNode('');
    this.allItems = [];
    this.searchableFields = [];
  }

  /**
   * Create a new node for the trie
   */
  private createNode(char: string): ZipTrieNode {
    return {
      char,
      children: new Map<string, ZipTrieNode>(),
      isEndOfWord: false,
      items: []
    };
  }

  /**
   * Insert a word into the trie
   * @param word The word to insert
   * @param item The data item associated with this word
   * @param skipLogging Whether to skip logging (for performance)
   */
  insert(word: string, item: Record<string, unknown>, skipLogging = false): void {
    if (!word || word.length === 0) return;

    // Normalize the word to lowercase for case-insensitive search
    const normalizedWord = word.toLowerCase();
    
    // Only log if not in performance mode
    if (!skipLogging) {
      console.log(`Inserting word: '${normalizedWord}'`);
    }

    let currentNode = this.root;

    // Traverse the trie and create nodes as needed
    for (let i = 0; i < normalizedWord.length; i++) {
      const char = normalizedWord[i];
      
      // If the character doesn't exist in the current node's children, create a new node
      if (!currentNode.children.has(char)) {
        currentNode.children.set(char, this.createNode(char));
      }

      // Move to the next node
      currentNode = currentNode.children.get(char)!;
    }

    // Mark the end of the word and store the item
    currentNode.isEndOfWord = true;
    
    // Only add the item if it's not already in the list - use reference comparison for speed
    // This is a performance optimization for large datasets
    const itemExists = currentNode.items.some(existingItem => existingItem === item);
    if (!itemExists) {
      currentNode.items.push(item);
    }
  }

  /**
   * Get a unique identifier for an item
   */
  private getItemId(item: Record<string, unknown>): string {
    // Use ID fields if available
    if (item.id) return String(item.id);
    if (item.Id) return String(item.Id);
    if (item.ID) return String(item.ID);
    if (item.OrganizationId) return String(item.OrganizationId);
    if (item.Index) return String(item.Index);

    // Fallback to using the whole object
    return JSON.stringify(item);
  }

  /**
   * Search the trie for words that match the given query
   * @param query The search query
   * @param limit Maximum number of results to return
   * @param highPerformance If true, minimize logging for better performance
   */
  search(
    query: string, 
    limit: number = 10, 
    highPerformance: boolean = false
  ): Array<{ data: Record<string, unknown>; score: number }> {
    if (!query) return [];

    const startTime = performance.now();
    const lowerQuery = query.toLowerCase().trim();
    
    if (!highPerformance) {
      console.log(`Searching for: "${lowerQuery}"`);
    }

    // Find the node corresponding to the query prefix
    const node = this.findNode(lowerQuery);

    // If no node found for the prefix, return empty results
    if (!node) {
      if (!highPerformance) {
        console.log('No matches found for prefix');
      }
      return [];
    }

    // Collect all items that match the prefix
    const results: Array<{ data: Record<string, unknown>; score: number }> = [];
    const seenItems = new Set<Record<string, unknown>>();

    // First, add exact matches (items at the node itself)
    if (node.isEndOfWord) {
      for (const item of node.items) {
        if (!seenItems.has(item)) {
          results.push({ data: item, score: 1.0 });
          seenItems.add(item);
        }
      }
    }

    // Then, collect all items from child nodes (words that start with the query)
    this.collectWords(node, lowerQuery, results, seenItems, limit);

    // Sort by score (higher score first)
    results.sort((a, b) => b.score - a.score);

    // Limit the number of results
    const limitedResults = results.slice(0, limit);
    
    if (!highPerformance) {
      const endTime = performance.now();
      const timeTaken = (endTime - startTime).toFixed(2);
      console.log(`Found ${limitedResults.length} results for "${lowerQuery}" in ${timeTaken}ms`);
    }

    return limitedResults;
  }

  /**
   * Special handling for single character searches
   */
  private searchSingleChar(char: string, limit: number): Array<{ word: string; data: Record<string, unknown> }> {
    const results: Array<{ word: string; data: Record<string, unknown> }> = [];
    const seenItems = new Set<string>();

    // Search through all items directly
    for (const item of this.allItems) {
      if (results.length >= limit) break;

      // Check each searchable field
      for (const field of this.searchableFields) {
        if (!item[field]) continue;

        const fieldValue = String(item[field]).toLowerCase();
        const words = fieldValue.split(/\s+/);

        // Check if any word starts with the character
        const startsWithChar = words.some(word => word.startsWith(char));

        if (startsWithChar || fieldValue.includes(char)) {
          const itemId = this.getItemId(item);
          if (!seenItems.has(itemId)) {
            results.push({ 
              word: String(item[field]), 
              data: item 
            });
            seenItems.add(itemId);
            break; // Only add each item once
          }
        }
      }
    }

    return results;
  }

  /**
   * Traditional prefix search
   */
  private searchPrefix(
    prefix: string,
    results: Array<{ data: Record<string, unknown>; score: number }>,
    seenItems: Set<Record<string, unknown>>,
    limit: number
  ): void {
    // Find the node corresponding to the prefix
    const current = this.findNode(prefix);

    if (!current) return; // Prefix not found

    // Collect all words that start with this prefix
    this.collectWords(current, prefix, results, seenItems, limit);
  }

  /**
   * Find a node in the trie that matches the given prefix
   */
  private findNode(prefix: string): ZipTrieNode | null {
    if (!prefix) return this.root;

    let current = this.root;
    const lowerPrefix = prefix.toLowerCase().trim();

    console.log(`Finding node for prefix: "${lowerPrefix}", root children:`, Array.from(this.root.children.keys()));

    // Navigate through the trie for each character in the prefix
    for (let i = 0; i < lowerPrefix.length; i++) {
      const char = lowerPrefix[i];

      // Process all characters (removed the filter that was skipping non-alphanumeric characters)
      console.log(`Checking for character: '${char}', available children:`, Array.from(current.children.keys()));

      if (!current.children.has(char)) {
        console.log(`Character '${char}' not found in trie at position ${i}`);
        return null; // Prefix not found
      }

      current = current.children.get(char)!;
    }

    console.log(`Found node for prefix: "${lowerPrefix}", has ${current.items.length} items`);
    return current;
  }

  /**
   * Collect all words from a given node
   */
  private collectWords(
    node: ZipTrieNode,
    prefix: string,
    results: Array<{ data: Record<string, unknown>; score: number }>,
    seenItems: Set<Record<string, unknown>>,
    limit: number
  ): void {
    if (results.length >= limit) return;

    // If this node is an end of word, add its items to results
    if (node.isEndOfWord && node.items.length > 0) {
      for (const item of node.items) {
        if (results.length >= limit) break;

        // Only add the item if it's not already in the results
        if (!seenItems.has(item)) {
          // Calculate score based on how closely the item matches the prefix
          let score = 1.0; // Exact match gets highest score
          
          // For prefix matches, score is slightly lower
          if (prefix.length > 0) {
            for (const field of this.searchableFields) {
              if (item[field] && String(item[field]).toLowerCase().startsWith(prefix)) {
                // Longer matches get higher scores
                score = 0.9 + (prefix.length / String(item[field]).length) * 0.1;
                break;
              } else if (item[field] && String(item[field]).toLowerCase().includes(prefix)) {
                // Contains but doesn't start with - lower score
                score = 0.7;
                break;
              }
            }
          }

          results.push({ 
            data: item,
            score: score
          });
          seenItems.add(item);
        }
      }
    }

    // Continue searching in all child nodes
    for (const [char, childNode] of node.children.entries()) {
      this.collectWords(childNode, prefix + char, results, seenItems, limit);
    }
  }

  /**
   * Search through all items for any matches
   */
  private searchAllItems(
    query: string,
    results: Array<{ word: string; data: Record<string, unknown> }>,
    seenItems: Set<string>,
    limit: number
  ): void {
    // Search through all items directly
    for (const item of this.allItems) {
      if (results.length >= limit) break;

      // Check each searchable field
      for (const field of this.searchableFields) {
        if (!item[field]) continue;

        const fieldValue = String(item[field]).toLowerCase();

        if (fieldValue.includes(query)) {
          const itemId = this.getItemId(item);
          if (!seenItems.has(itemId)) {
            results.push({ 
              word: String(item[field]), 
              data: item 
            });
            seenItems.add(itemId);
            break; // Only add each item once
          }
        }
      }
    }
  }

  /**
   * Load data into the trie
   * @param data Array of data records to load
   * @param fields Array of field names to index
   * @param isBatch If true, this is part of a batch load and won't clear existing data
   * @param highPerformance If true, minimize logging and optimize for speed
   */
  loadData(data: Record<string, unknown>[], fields: string[], isBatch: boolean = false, highPerformance: boolean = false): void {
    console.log(`ZipTrie.loadData called with ${data.length} items and fields:`, fields);

    // Validate inputs
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn('No data provided to load into ZipTrie');
      return;
    }

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      console.warn('No fields specified for ZipTrie indexing');
      return;
    }

    // If this is not a batch load, initialize the trie
    if (!isBatch) {
      // Store the data and fields for direct access
      this.allItems = data;
      this.searchableFields = fields;

      // Always log sample data for debugging
      console.log('Sample data items:');
      data.slice(0, 2).forEach((item, index) => {
        console.log(`Item ${index}:`, JSON.stringify(item));
      });

      // Clear existing trie
      this.clear();
      console.log('Trie cleared for new data loading');
    } else {
      // For batch loads, append to existing data
      this.allItems = this.allItems.concat(data);
      
      // Always log a sample for batches
      if (data.length > 0) {
        console.log('Batch sample item:', JSON.stringify(data[0]));
      }
    }

    // Process each item with appropriate logging
    // We're now using direct logging with specific thresholds instead of a shouldLog variable
    
    // Process in bulk for better performance
    
    // Process in bulk for better performance
    const startTime = Date.now();
    const totalItems = data.length;
    
    // Process all items directly for reliability
    console.log(`Processing ${totalItems} items for indexing...`);
    
    // Track some stats for debugging
    let indexedFields = 0;
    let indexedWords = 0;
    
    // Process each item
    for (let itemIdx = 0; itemIdx < totalItems; itemIdx++) {
      const item = data[itemIdx];
      
      // For each searchable field
      for (const field of fields) {
        if (!item[field]) continue;

        const fieldValue = String(item[field]);
        indexedFields++;
        
        // Log sample values for debugging
        if (itemIdx < 5) {
          console.log(`Sample field ${field} with value: "${fieldValue}"`);
        }

        // Insert the entire field value
        this.insert(fieldValue, item, false);

        // Also insert individual words
        const words = fieldValue.split(/\s+/);
        for (const word of words) {
          if (word.length > 0) {
            indexedWords++;
            this.insert(word, item, true);

            // For longer words, also index prefixes
            if (word.length > 2) {
              // Index all prefixes for better search results
              for (let i = 2; i <= word.length; i++) {
                this.insert(word.substring(0, i), item, true);
              }
            }
          }
        }
        
        // Additionally, index the entire field value as a single string with all characters
        // This ensures searches with special characters or spaces will work
        if (fieldValue.length > 0) {
          for (let i = 1; i <= fieldValue.length; i++) {
            this.insert(fieldValue.substring(0, i), item, true);
          }
        }
      }
      
      // Log progress for large datasets
      if (itemIdx > 0 && (itemIdx % 1000 === 0 || itemIdx === totalItems - 1)) {
        console.log(`Indexed ${itemIdx + 1}/${totalItems} items (${Math.round((itemIdx + 1) / totalItems * 100)}%)`);
      }
    }
    
    console.log(`Indexed ${indexedFields} fields and ${indexedWords} words total.`);
    
    // Log performance metrics if not in high performance mode
    if (!highPerformance) {
      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      console.log(`ZipTrie indexing completed in ${processingTime.toFixed(2)} seconds for ${totalItems} items`);
      
      // Run sample searches only after complete load or for small datasets
      if (!isBatch || data.length < 100) {
        console.log('ZipTrie built. Running sample searches:');
        console.log('Search for "f":', JSON.stringify(this.search('f', 2)));
        console.log('Search for "fe":', JSON.stringify(this.search('fe', 2)));
        console.log('Search for "fer":', JSON.stringify(this.search('fer', 2)));
      }
    }
  }

  /**
   * Clear all data from the trie
   */
  clear(): void {
    this.root = this.createNode('');
  }

  /**
   * Get all words in the trie (for debugging)
   */
  getAllWords(limit: number = 20): string[] {
    const words: string[] = [];

    const traverse = (node: ZipTrieNode, prefix: string) => {
      if (words.length >= limit) return;

      if (node.isEndOfWord) {
        words.push(prefix);
      }

      for (const [char, childNode] of node.children.entries()) {
        traverse(childNode, prefix + char);
      }
    };

    traverse(this.root, '');
    return words;
  }

  /**
   * Get the tree structure for visualization
   */
  getTreeVisualization(): TrieVisualizationNode {
    return this.convertNode(this.root);
  }

  /**
   * Get the search path for a query to visualize how the search traverses the trie
   */
  getSearchPath(query: string): TrieVisualizationNode[] {
    const path: TrieVisualizationNode[] = [];
    let current = this.root;
    
    // Add the root node to the path
    path.push(this.convertNode(current));
    
    // Convert query to lowercase for case-insensitive search
    const lowerQuery = query.toLowerCase();
    
    // Traverse the trie based on the query
    for (let i = 0; i < lowerQuery.length; i++) {
      const char = lowerQuery[i];
      
      if (current.children.has(char)) {
        current = current.children.get(char)!;
        path.push(this.convertNode(current));
      } else {
        // If we can't find the character, stop traversal
        break;
      }
    }
    
    return path;
  }

  /**
   * Convert a ZipTrieNode to a TrieVisualizationNode for visualization
   */
  private convertNode(node: ZipTrieNode): TrieVisualizationNode {
    const children: TrieVisualizationNode[] = [];
    
    for (const [, childNode] of node.children.entries()) {
      children.push(this.convertNode(childNode));
    }
    
    // Sort children alphabetically for consistent visualization
    children.sort((a, b) => a.char.localeCompare(b.char));
    
    return {
      char: node.char || '',
      isEndOfWord: node.isEndOfWord,
      itemCount: node.items.length,
      children
    };
  }

  /**
   * Find a path in the trie for a given prefix
   */
  findPath(prefix: string): TrieVisualizationNode[] | null {
    let current = this.root;
    const path: TrieVisualizationNode[] = [];
    const lowerPrefix = prefix.toLowerCase();

    // Add the root to the path
    path.push({
      char: current.char,
      isEndOfWord: current.isEndOfWord,
      itemCount: current.items.length,
      children: []
    });

    // Traverse the trie for each character in the prefix
    for (let i = 0; i < lowerPrefix.length; i++) {
      const currentChar = lowerPrefix[i];
      if (!current.children.has(currentChar)) {
        return path; // Return the path so far if we can't go further
      }

      current = current.children.get(currentChar)!;
      path.push({
        char: current.char,
        isEndOfWord: current.isEndOfWord,
        itemCount: current.items.length,
        children: []
      });
    }

    return path;
  }
}

/**
 * Create a new ZipTrie instance with data loaded
 */
export function createZipTrie(data: Record<string, unknown>[], searchFields: string[]): ZipTrie {
  const trie = new ZipTrie();
  trie.loadData(data, searchFields);
  return trie;
}