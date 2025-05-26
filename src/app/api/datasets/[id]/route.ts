// src/app/api/datasets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { userDataStore } from '@/lib/dataStore';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get the dataset ID from the URL params
    const datasetId = context.params.id;
    
    if (!datasetId) {
      return NextResponse.json(
        { error: 'Dataset ID is required' },
        { status: 400 }
      );
    }
    
    // Authenticate the user
    const auth = getAuth(request);
    const userId = auth.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log(`Fetching dataset ${datasetId} for user ${userId}`);
    
    // Fetch the dataset from the database with related products count
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: datasetId,
        userId: userId
      },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    
    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }
    
    // Check if we have the dataset in the in-memory store
    let inMemoryData = null;
    if (userDataStore[userId]) {
      console.log('User has data in memory store');
      if (userDataStore[userId].dataId === datasetId) {
        console.log('Dataset found in memory store');
        inMemoryData = {
          fields: userDataStore[userId].searchFields,
          preview: userDataStore[userId].rawData.slice(0, 10)
        };
      }
    }
    
    // Return the dataset with additional in-memory data if available
    return NextResponse.json({
      dataset: {
        id: dataset.id,
        name: dataset.name,
        createdAt: dataset.createdAt,
        itemCount: dataset._count?.products || 0,
        fields: inMemoryData ? inMemoryData.fields : [],
        preview: inMemoryData ? inMemoryData.preview : []
      }
    });
    
  } catch (error) {
    console.error('Error fetching dataset:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching the dataset' },
      { status: 500 }
    );
  }
}
