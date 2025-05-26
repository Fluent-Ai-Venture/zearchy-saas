import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { userDataStore } from '@/lib/dataStore';

export async function GET(request: NextRequest) {
  try {
    // Get the user ID from the auth session
    const { userId } = getAuth(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const dataId = searchParams.get('dataId');
    
    // Validate required parameters
    if (!query) {
      return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
    }
    
    if (!dataId) {
      return NextResponse.json({ error: 'Missing dataId parameter' }, { status: 400 });
    }
    
    // Check if user has data
    if (!userDataStore[userId]) {
      return NextResponse.json({ error: 'No data found for user' }, { status: 404 });
    }
    
    // Check if the specified dataId exists
    if (userDataStore[userId].dataId !== dataId) {
      return NextResponse.json({ error: 'Data ID not found' }, { status: 404 });
    }
    
    // Get the trie visualization data
    const trieVisualization = userDataStore[userId].trie.getTreeVisualization();
    
    // Get the search path for visualization
    const searchPath = userDataStore[userId].trie.getSearchPath(query);
    
    // Return the visualization data
    return NextResponse.json({
      trieVisualization,
      searchPath
    });
  } catch (error) {
    console.error('Visualization API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
