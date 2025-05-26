// src/app/api/datasets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuth } from '@clerk/nextjs/server';

/**
 * GET endpoint to list all datasets for a user
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user ID from Clerk
    const auth = getAuth(request);
    const userId = auth.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('Fetching datasets for user:', userId);
    
    // Fetch all datasets for this user
    const datasets = await prisma.dataset.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });
    
    // Define a type for the dataset with count
    type DatasetWithCount = {
      id: string;
      name: string;
      createdAt: Date;
      _count: { products: number };
    };
    
    // Format the response
    const formattedDatasets = datasets.map((dataset: DatasetWithCount) => ({
      id: dataset.id,
      name: dataset.name,
      createdAt: dataset.createdAt,
      itemCount: dataset._count.products
    }));
    
    return NextResponse.json({
      datasets: formattedDatasets || [],
      message: formattedDatasets.length === 0 ? 'No datasets found' : `Found ${formattedDatasets.length} datasets`
    });
  } catch (error) {
    console.error('Error fetching datasets:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching datasets' },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to remove a dataset and all associated data
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get the dataset ID from the request
    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get('id');
    
    if (!datasetId) {
      return NextResponse.json(
        { error: 'Dataset ID is required' },
        { status: 400 }
      );
    }
    
    // Get the authenticated user ID from Clerk
    const auth = getAuth(request);
    const userId = auth.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log(`Deleting dataset ${datasetId} for user ${userId}`);
    
    // Verify the dataset exists and belongs to the user
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
    
    // Delete the dataset and all associated data
    await prisma.dataset.delete({
      where: {
        id: datasetId
      }
    });
    
    // Also clear any trie data associated with this dataset
    await prisma.trie.deleteMany({
      where: {
        datasetId: datasetId
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Dataset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dataset:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting the dataset' },
      { status: 500 }
    );
  }
}
