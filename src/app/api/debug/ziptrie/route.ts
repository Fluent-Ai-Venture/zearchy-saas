import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { userDataStore } from '@/lib/dataStore';

// Import the ZipTrie class from the ziptrie module
import { ZipTrie } from '@/lib/ziptrie';

/**
 * GET handler for the debug/ziptrie endpoint
 * This endpoint returns a visualization of the ZipTrie structure for debugging purposes
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const dataId = searchParams.get('dataId') || '';
    
    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has data in the store
    if (!userDataStore[userId]) {
      return NextResponse.json({ error: 'No data found for this user' }, { status: 404 });
    }
    
    // Check if the dataId matches
    if (userDataStore[userId].dataId !== dataId) {
      return NextResponse.json({ error: 'Invalid dataId' }, { status: 400 });
    }
    
    // Create a simplified visualization of the ZipTrie
    const zipTrieVisualization = visualizeZipTrie(userDataStore[userId].trie);
    
    // Get a sample of the raw data
    const rawDataSample = userDataStore[userId].rawData.slice(0, 5);
    
    // Return the ZipTrie visualization
    return NextResponse.json({
      dataId,
      searchFields: userDataStore[userId].searchFields,
      zipTrieVisualization,
      rawDataSample,
      stats: {
        totalData: userDataStore[userId].rawData.length,
        lastUpdated: userDataStore[userId].lastUpdated
      }
    });
  } catch (error) {
    console.error('Error in debug/ziptrie endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Helper function to visualize the ZipTrie structure
 */
function visualizeZipTrie(trie: ZipTrie) {
  // Use the public methods to get the tree visualization
  return {
    structure: trie.getTreeVisualization ? trie.getTreeVisualization() : { char: '', children: [] },
    searchMethod: trie.search ? trie.search.toString() : ''
  };
}

// No longer needed as we're using the built-in visualization methods

// No longer needed as we're not counting nodes manually
