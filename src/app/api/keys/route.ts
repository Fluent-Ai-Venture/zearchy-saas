import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

// Generate a secure random API key
function generateApiKey(): string {
  // Generate 32 random bytes and convert to a hex string
  return crypto.randomBytes(32).toString('hex');
}

// GET /api/keys - List all API keys for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = getAuth(request);
    const userId = auth.userId;
    
    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Fetch all active API keys for the user
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        isActive: true,
        // Don't return the actual key for security
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

// POST /api/keys - Create a new API key
export async function POST(request: NextRequest) {
  try {
    // Get authentication information
    const auth = getAuth(request);
    const userId = auth.userId;
    
    // Add detailed logging for debugging
    console.log('Auth info:', { 
      userId, 
      hasUserId: !!userId,
      sessionId: auth.sessionId,
      sessionClaimsExist: !!auth.sessionClaims
    });
    
    // Check if user is authenticated
    if (!userId) {
      console.error('Unauthorized: No userId found in auth object');
      return NextResponse.json({ 
        error: 'Unauthorized', 
        details: 'Authentication failed - no user ID found' 
      }, { status: 401 });
    }
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error('Error parsing request body:', e);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const { name, permissions = {} } = body;
    
    console.log('Request body:', { name, permissions });
    
    if (!name) {
      return NextResponse.json({ error: 'API key name is required' }, { status: 400 });
    }
    
    // Generate a new API key
    const key = generateApiKey();
    
    // Create the API key in the database
    console.log('Creating API key for user:', userId);
    try {
      const apiKey = await prisma.apiKey.create({
        data: {
          userId,
          key,
          name,
          permissions: typeof permissions === 'object' ? permissions : {},
          isActive: true,
        },
      });
      
      console.log('API key created successfully:', { id: apiKey.id, name: apiKey.name });
      
      // Return the newly created API key (including the actual key)
      return NextResponse.json({
        id: apiKey.id,
        key: apiKey.key, // Only return the actual key once when it's created
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        isActive: apiKey.isActive,
      });
    } catch (dbError) {
      console.error('Database error creating API key:', dbError);
      return NextResponse.json({ 
        error: 'Database error', 
        details: dbError instanceof Error ? dbError.message : String(dbError)
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating API key:', error);
    
    // Return more detailed error information
    return NextResponse.json({ 
      error: 'Failed to create API key', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PUT /api/keys - Update an API key (revoke or rename)
export async function PUT(request: NextRequest) {
  try {
    const auth = getAuth(request);
    const userId = auth.userId;
    
    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { id, name, isActive } = body;
    
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
    
    // Update the API key
    const apiKey = await prisma.apiKey.update({
      where: {
        id,
      },
      data: {
        name: name !== undefined ? name : existingKey.name,
        isActive: isActive !== undefined ? isActive : existingKey.isActive,
      },
    });
    
    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
  }
}

// DELETE /api/keys - Delete an API key
export async function DELETE(request: NextRequest) {
  try {
    const auth = getAuth(request);
    const userId = auth.userId;
    
    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the API key ID from the URL
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
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
    
    // Delete the API key
    await prisma.apiKey.delete({
      where: {
        id,
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
