// src/app/api/trie/[datasetId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { verifyApiKey, hasDatasetAccess } from '@/lib/apiKeyMiddleware';

/**
 * GET endpoint to retrieve a ZipTrie and its associated data
 * This allows clients to perform local searches without server dependency
 */
export async function GET(
  request: NextRequest,
  context: { params: { datasetId: string } }
) {
  try {
    // First try to authenticate with API key
    const apiKeyUserId = await verifyApiKey(request);
    
    // If no API key, fall back to Clerk authentication
    let userId = apiKeyUserId;
    if (!userId) {
      const auth = getAuth(request);
      userId = auth.userId;
    }
    
    const { datasetId } = context.params;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Verify the user has access to this dataset
    const hasAccess = await hasDatasetAccess(userId, datasetId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this dataset' },
        { status: 403 }
      );
    }
    
    // No need to check authentication for now
    // This allows the app to work without Clerk authentication setup
    
    // Fetch the dataset to verify ownership
    const dataset = await prisma.dataset.findUnique({
      where: {
        id: datasetId
      }
    });
    
    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }
    
    // Verify the dataset belongs to the user
    if (dataset.userId !== userId) {
      return NextResponse.json(
        { error: 'You do not have access to this dataset' },
        { status: 403 }
      );
    }
    
    // Fetch the trie data
    const trie = await prisma.trie.findUnique({
      where: {
        datasetId: datasetId
      }
    });
    
    if (!trie) {
      return NextResponse.json(
        { error: 'Trie data not found for this dataset' },
        { status: 404 }
      );
    }
    
    // Fetch all products for this dataset
    const products = await prisma.product.findMany({
      where: {
        datasetId: datasetId
      },
      select: {
        id: true,
        data: true
      }
    });
    
    // Build a map of product IDs to their data
    const itemsMap: Record<string, unknown> = {};
    products.forEach((product: { id: string; data: unknown }) => {
      itemsMap[product.id] = product.data;
    });
    
    // Log the trie data for debugging
    console.log('Number of products:', products.length);
    
    // Safely extract the trie structure from the JSON data
    let trieStructure: Record<string, unknown> = {};
    try {
      // Extract the trie structure from the JSON data
      const trieJsonData = trie.trieJson as Record<string, unknown>;
      
      if (trieJsonData && typeof trieJsonData === 'object' && 'trie' in trieJsonData) {
        // If the trie data is stored in a nested 'trie' field
        const nestedTrie = trieJsonData.trie;
        if (nestedTrie && typeof nestedTrie === 'object') {
          trieStructure = nestedTrie as Record<string, unknown>;
          console.log('Using nested trie structure');
        }
      } else {
        // Otherwise use the entire trieJson object
        trieStructure = trieJsonData;
        console.log('Using direct trie structure');
      }
      
      console.log('Trie structure type:', typeof trieStructure);
      console.log('Trie structure preview:', JSON.stringify(trieStructure).substring(0, 100) + '...');
    } catch (err) {
      console.error('Error extracting trie structure:', err);
      trieStructure = {}; // Fallback to empty structure
    }
    
    // Return the trie and items map
    return NextResponse.json({
      trie: trieStructure,
      items: itemsMap,
      datasetId: datasetId,
      datasetName: dataset.name,
      totalItems: products.length
    });
  } catch (error) {
    console.error('Error fetching trie data:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching the trie data' },
      { status: 500 }
    );
  }
}
