import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

// Generate a secure random API key
function generateApiKey(): string {
  // Generate 32 random bytes and convert to a hex string
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/keys/regenerate - Regenerate an existing API key
export async function POST(request: NextRequest) {
  try {
    const auth = getAuth(request);
    const userId = auth.userId;
    
    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'API key ID is required' }, { status: 400 });
    }
    
    // Check if the API key belongs to the user
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId,
      },
    });
    
    if (!existingKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }
    
    // Generate a new API key
    const newKey = generateApiKey();
    
    // Update the API key with the new value
    const apiKey = await prisma.apiKey.update({
      where: {
        id,
      },
      data: {
        key: newKey,
        // Reset lastUsedAt since this is a new key
        lastUsedAt: null,
      },
    });
    
    // Return the regenerated API key
    return NextResponse.json({
      id: apiKey.id,
      key: newKey, // Return the new key
      name: apiKey.name,
      createdAt: apiKey.createdAt,
      isActive: apiKey.isActive,
    });
  } catch (error) {
    console.error('Error regenerating API key:', error);
    return NextResponse.json({ error: 'Failed to regenerate API key' }, { status: 500 });
  }
}
