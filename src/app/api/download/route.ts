// src/app/api/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { userDataStore } from '@/lib/dataStore';
import { TrieVisualizationNode } from '@/lib/ziptrie';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    const compress = request.nextUrl.searchParams.get('compress') === 'true';
    
    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check if we have data for this user
    if (!userDataStore[userId] || !userDataStore[userId].trie) {
      console.log('No data found for userId:', userId);
      return NextResponse.json({
        error: 'No data found. Please upload data first.'
      }, { status: 404 });
    }
    
    // Log what we found to help with debugging
    console.log(`Found data for userId: ${userId}`, {
      dataId: userDataStore[userId].dataId,
      totalRecords: userDataStore[userId].totalRecords,
      hasRawData: Array.isArray(userDataStore[userId].rawData) && userDataStore[userId].rawData.length > 0
    });
    
    // Get the user's data
    const userData = userDataStore[userId];
    
    // Get the trie visualization data which we'll transform
    const trieVisualization = userData.trie.getTreeVisualization();
    
    // Create an optimized representation of the ZipTrie with path compression
    const optimizedTrie = createOptimizedTrie(trieVisualization);
    
    // Extract items from the raw data and create a separate items map
    const itemsMap = createItemsMap(userData.rawData);
    
    // Create a JSON representation of the ZipTrie with optimized structure
    const zipTrieRepresentation = {
      // Basic metadata
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '2.0.0',
        userId: userId,
        dataId: userData.dataId,
        totalRecords: userData.totalRecords,
        searchFields: userData.searchFields,
        returnFields: userData.returnFields,
        format: 'optimized-ziptrie'
      },
      // Items map for efficient storage
      items: itemsMap,
      // Optimized trie structure with path compression
      trie: optimizedTrie
    };
    
    console.log(`Preparing optimized ZipTrie download for user ${userId}`);
    
    // If compression is requested, compress the JSON
    if (compress) {
      // For browser-based compression, we'll just return the JSON with a header indicating it should be compressed
      // The actual compression will happen client-side using the browser's built-in compression
      return NextResponse.json(zipTrieRepresentation, {
        headers: {
          'Content-Disposition': `attachment; filename=zearchy-ziptrie-${new Date().toISOString().split('T')[0]}.json`,
          'X-Compression-Hint': 'true'
        }
      });
    }
    
    return NextResponse.json(zipTrieRepresentation);
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'An error occurred while preparing your download', details: String(error) },
      { status: 500 }
    );
  }
}

// Define types for our optimized trie structure
type OptimizedTrieNode = {
  k: string;              // key (compressed path)
  i?: string[];          // itemIds (references to items in the items map)
  c?: Record<string, OptimizedTrieNode>; // children
};

type ItemMap = Record<string, Record<string, unknown>>;

/**
 * Create an optimized trie with path compression
 * This function transforms the visualization tree into a path-compressed trie
 */
function createOptimizedTrie(root: TrieVisualizationNode): OptimizedTrieNode {
  // Skip the root node as it doesn't contain useful information
  const optimizedRoot: OptimizedTrieNode = { k: '' };
  
  // Process each child of the root separately
  if (root.children && root.children.length > 0) {
    optimizedRoot.c = {};
    
    for (const child of root.children) {
      const childPath = compressPath(child, child.char);
      
      // Only add non-empty paths
      if (childPath) {
        optimizedRoot.c[child.char] = childPath;
      }
    }
    
    // If no children were added, delete the empty children object
    if (Object.keys(optimizedRoot.c).length === 0) {
      delete optimizedRoot.c;
    }
  }
  
  return optimizedRoot;
}

/**
 * Compress a path in the trie by combining nodes with single children
 */
function compressPath(node: TrieVisualizationNode, currentPath: string): OptimizedTrieNode {
  // Start with current node's character
  let path = currentPath;
  let currentNode = node;
  
  // Compress path while node has exactly one child and no items
  while (
    currentNode.children && 
    currentNode.children.length === 1 && 
    !currentNode.isEndOfWord && 
    currentNode.itemCount === 0
  ) {
    // Get the only child
    const nextNode = currentNode.children[0];
    path += nextNode.char;
    currentNode = nextNode;
  }
  
  // Create the optimized node with the compressed path
  const optimizedNode: OptimizedTrieNode = { k: path };
  
  // Add item IDs if this node has items
  if (currentNode.itemCount > 0) {
    // Since we don't have direct access to the items, we'll use the path as an identifier
    // The actual items will be mapped in the createItemsMap function
    optimizedNode.i = [path];
  }
  
  // Process children recursively
  if (currentNode.children && currentNode.children.length > 0) {
    optimizedNode.c = {};
    
    for (const childNode of currentNode.children) {
      const childPath = compressPath(childNode, childNode.char);
      if (childPath) {
        optimizedNode.c[childNode.char] = childPath;
      }
    }
    
    // If no children were added, delete the empty children object
    if (Object.keys(optimizedNode.c).length === 0) {
      delete optimizedNode.c;
    }
  }
  
  return optimizedNode;
}

/**
 * Create a map of item IDs to items from the raw data
 */
function createItemsMap(rawData: Record<string, unknown>[]): ItemMap {
  const itemsMap: ItemMap = {};
  
  // Process each item in the raw data
  for (const item of rawData) {
    // Generate a unique ID for the item
    const itemId = generateItemId(item);
    itemsMap[itemId] = item;
  }
  
  return itemsMap;
}

/**
 * Generate a unique ID for an item
 */
function generateItemId(item: Record<string, unknown>): string {
  // Use ID fields if available
  if (item.id) return String(item.id);
  if (item.Id) return String(item.Id);
  if (item.ID) return String(item.ID);
  if (item.OrganizationId) return String(item.OrganizationId);
  if (item.Index) return String(item.Index);
  
  // Fallback to using a hash of the item
  return hashObject(item);
}

/**
 * Create a simple hash of an object for use as an ID
 */
function hashObject(obj: Record<string, unknown>): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}
