import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Middleware to verify API key for external client access
 * This allows clients to access the search and trie endpoints with an API key
 * instead of requiring Clerk authentication
 */
export async function verifyApiKey(request: NextRequest) {
  // Get the API key from the Authorization header
  const apiKey = request.headers.get('x-api-key');
  
  // If no API key is provided, return null (will fall back to Clerk auth)
  if (!apiKey) {
    return null;
  }
  
  try {
    // Look up the API key in the database
    const key = await prisma.apiKey.findFirst({
      where: {
        key: apiKey,
        isActive: true,
      },
    });
    
    // If the key doesn't exist or is inactive, return null
    if (!key) {
      return null;
    }
    
    // Update the lastUsedAt timestamp
    await prisma.apiKey.update({
      where: {
        id: key.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });
    
    // Return the user ID associated with the API key
    return key.userId;
  } catch (error) {
    console.error('Error verifying API key:', error);
    return null;
  }
}

/**
 * Check if the user has access to the specified dataset
 */
export async function hasDatasetAccess(userId: string, datasetId: string): Promise<boolean> {
  try {
    // Check if the dataset belongs to the user
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: datasetId,
        userId: userId,
      },
    });
    
    return !!dataset;
  } catch (error) {
    console.error('Error checking dataset access:', error);
    return false;
  }
}
