// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { ZipTrie } from '@/lib/ziptrie';
import { userDataStore } from '@/lib/dataStore';
import { prisma } from '@/lib/db';
import { verifyApiKey, hasDatasetAccess } from '@/lib/apiKeyMiddleware';

// Note: We're using Prisma's automatic type inference for the product data

/**
 * Debug function to log the ZipTrie structure
 */
function debugZipTrie(trie: ZipTrie) {
  // Log the search fields that are indexed
  console.log('ZipTrie instance:', trie);
  console.log('ZipTrie search method:', trie.search.toString());
  
  // Log some sample searches to see what's in the trie
  console.log('Sample search for "ferr":', trie.search('ferr', 5));
  console.log('Sample search for "fer":', trie.search('fer', 5));
  console.log('Sample search for "f":', trie.search('f', 5));
  
  // Log all words in the trie (up to 20)
  console.log('All words in trie (up to 20):', trie.getAllWords(20));
}

/**
 * Helper function to perform search on in-memory data
 */
async function performInMemorySearch(
  userData: {
    trie: ZipTrie;
    searchFields: string[];
    returnFields: string[];
  },
  query: string,
  searchFields: string[],
  limit: number
) {
  // Determine which fields to use for search
  let fieldsToUse = userData.searchFields;
  
  // If specific fields were requested and they're different from the current ones, use those instead
  if (searchFields.length > 0 && JSON.stringify(searchFields) !== JSON.stringify(userData.searchFields)) {
    console.log('Using requested search fields:', searchFields);
    fieldsToUse = searchFields;
  }
  
  // Debug the trie structure
  debugZipTrie(userData.trie);
  
  // Perform the search
  console.time('search');
  const startTime = performance.now();
  const searchResults = userData.trie.search(query, limit);
  const endTime = performance.now();
  console.timeEnd('search');
  
  // Calculate search performance metrics
  const searchTime = endTime - startTime;
  console.log(`Search completed in ${searchTime.toFixed(2)}ms with ${searchResults.length} results`);
  
  // Format the results for the response
  const formattedResults = searchResults.map(item => {
    // Extract only the fields that should be returned
    const result: Record<string, unknown> = {};
    
    // Use the return fields from the user data store
    const fieldsToReturn = userData.returnFields || fieldsToUse;
    
    // Extract the requested fields
    fieldsToReturn.forEach(field => {
      if (field in item.data) {
        result[field] = item.data[field];
      }
    });
    
    // Add the score
    result._score = item.score;
    
    return result;
  });
  
  // Return the search results without visualization data
  return NextResponse.json({
    results: formattedResults,
    performance: {
      time: searchTime,
      resultsCount: searchResults.length,
      query: query
    }
  });
}

/**
 * GET endpoint for searching data
 */
export async function GET(request: NextRequest) {
  try {
    // First try to authenticate with API key
    const apiKeyUserId = await verifyApiKey(request);
    
    // If no API key, fall back to Clerk authentication
    let userId = apiKeyUserId;
    if (!userId) {
      const auth = getAuth(request);
      userId = auth.userId;
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const dataId = searchParams.get('dataId') || '';
    const fieldsParam = searchParams.get('fields') || '';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '10') : 10;
    
    // Parse the fields parameter if provided
    const searchFields = fieldsParam ? fieldsParam.split(',') : [];
    
    console.log('Search request:', { userId, query, dataId, searchFields, limit });
    console.log('Search query (lowercase):', query.toLowerCase());
    
    // First check if we have data in memory for quick search
    if (userDataStore[userId] && userDataStore[userId].dataId === dataId) {
      console.log('Using in-memory data for search');
      return performInMemorySearch(userDataStore[userId], query, searchFields, limit);
    }
    
    // If not in memory, fetch from database
    console.log('Fetching data from database for dataId:', dataId || 'latest');
    
    // If no specific dataId is provided, get the latest dataset
    let targetDatasetId = dataId;
    if (!targetDatasetId) {
      const latestDataset = await prisma.dataset.findFirst({
        where: { userId: userId },
        orderBy: { createdAt: 'desc' }
      });
      
      if (!latestDataset) {
        console.log('No datasets found for user:', userId);
        return NextResponse.json({
          results: [],
          message: 'No data found. Please upload data first.'
        });
      }
      
      targetDatasetId = latestDataset.id;
      console.log('Using latest dataset:', targetDatasetId);
    }
    
    // Fetch the dataset with its products
    const dataset = await prisma.dataset.findUnique({
      where: { id: targetDatasetId },
      include: {
        products: true,
        trie: true
      }
    });
    
    if (!dataset) {
      console.log('Dataset not found:', targetDatasetId);
      return NextResponse.json({
        results: [],
        message: 'Dataset not found.'
      });
    }
    
    console.log(`Found dataset with ${dataset.products.length} products`);
    
    // Extract the data from the products
    const rawData = dataset.products.map(product => product.data as Record<string, unknown>);
    
    // Determine which fields to use for search
    let fieldsToUse = searchFields;
    
    // If no fields are specified and we have trie data, use the fields from there
    if (fieldsToUse.length === 0 && dataset.trie?.trieJson) {
      const trieData = dataset.trie.trieJson as Record<string, unknown>;
      if (trieData.fields && Array.isArray(trieData.fields)) {
        fieldsToUse = trieData.fields as string[];
      }
    }
    
    // If still no fields, use all available fields from the first item
    if (fieldsToUse.length === 0 && rawData.length > 0) {
      fieldsToUse = Object.keys(rawData[0]);
    }
    
    console.log('Using search fields:', fieldsToUse);
    
    // Create a new ZipTrie and load the data
    const trie = new ZipTrie();
    console.log(`Loading ${rawData.length} items with fields:`, fieldsToUse);
    trie.loadData(rawData, fieldsToUse);
    
    // Store in memory for future searches
    userDataStore[userId] = {
      dataId: targetDatasetId,
      trie,
      rawData,
      searchFields: fieldsToUse,
      returnFields: fieldsToUse,
      lastUpdated: new Date(),
      totalRecords: rawData.length
    };
    
    // Now perform the search with the loaded data
    return performInMemorySearch(userDataStore[userId], query, fieldsToUse, limit);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'An error occurred during search', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for configuring search or uploading data
 */
export async function POST(request: NextRequest) {
  try {
    // First try to authenticate with API key
    const apiKeyUserId = await verifyApiKey(request);
    
    // If no API key, fall back to Clerk authentication
    let userId = apiKeyUserId;
    if (!userId) {
      const auth = getAuth(request);
      userId = auth.userId;
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse the request body
    const body = await request.json();
    const { dataId, searchFields = [], returnFields = [], data } = body;
    
    console.log('POST request to /api/search:', { dataId, searchFieldsCount: searchFields.length });
    
    // Case 1: Search configuration request
    if (dataId && searchFields.length > 0 && !data) {
      console.log('Processing search configuration request for dataId:', dataId);
      console.log('Search fields:', searchFields);
      console.log('Return fields:', returnFields);
      
      // Fetch the dataset from the database
      const dataset = await prisma.dataset.findUnique({
        where: { id: dataId },
        include: {
          products: true,
          trie: true
        }
      });
      
      // Verify the user has access to this dataset
      const hasAccess = await hasDatasetAccess(userId, dataId);
      if (!dataset || !hasAccess) {
        console.error('Dataset not found:', dataId);
        return NextResponse.json({
          error: 'Dataset not found',
          status: 'error'
        }, { status: 404 });
      }
      
      // Extract the data from the products
      const rawData = dataset.products.map(product => product.data as Record<string, unknown>);
      
      // Create a new ZipTrie and load the data with the specified search fields
      const trie = new ZipTrie();
      console.log(`Loading ${rawData.length} items with fields:`, searchFields);
      trie.loadData(rawData, searchFields);
      
      // Store the configuration in memory
      userDataStore[userId] = {
        dataId,
        trie,
        rawData,
        searchFields,
        returnFields: returnFields.length > 0 ? returnFields : searchFields,
        lastUpdated: new Date(),
        totalRecords: rawData.length
      };
      
      // Log the trie structure after loading
      console.log('=== ZIPTRIE STRUCTURE AFTER LOADING ===');
      debugZipTrie(trie);
      console.log('=== END ZIPTRIE STRUCTURE ===');
      
      console.log('Configuration updated successfully for userId:', userId);
      
      return NextResponse.json({
        success: true,
        message: 'Search configuration updated successfully',
        dataId,
        fieldsConfigured: searchFields.length
      });
    }
    
    // Case 2: Data upload request (from upload API)
    if (data && Array.isArray(data) && dataId) {
      console.log('Processing data upload request for dataId:', dataId);
      console.log('Received data with', data.length, 'items');
      
      // Validate the data
      if (data.length === 0) {
        console.error('Received empty data array');
        return NextResponse.json({
          error: 'No data found in the uploaded file',
          status: 'error'
        }, { status: 400 });
      }
      
      // Log sample data to verify structure
      console.log('Sample data items:');
      data.slice(0, 2).forEach((item: Record<string, unknown>, index: number) => {
        console.log(`Item ${index}:`, JSON.stringify(item));
      });
      
      // Clean and normalize the data
      const cleanedData = data.map((item: Record<string, unknown>) => {
        const cleanedItem: Record<string, unknown> = {};
        
        // Process each field
        Object.entries(item).forEach(([key, value]) => {
          // Skip empty values
          if (value === null || value === undefined || value === '') {
            return;
          }
          
          // Normalize field names (trim whitespace, ensure consistent casing)
          const cleanKey = key.trim();
          
          // Store the value
          cleanedItem[cleanKey] = value;
        });
        
        return cleanedItem;
      });
      
      console.log('Cleaned data sample:', JSON.stringify(cleanedData.slice(0, 1)));
      
      // Determine fields to index if not provided
      const fieldsToIndex = searchFields.length > 0 ? 
        searchFields : 
        Object.keys(cleanedData[0] || {});
      
      console.log('Fields to index:', fieldsToIndex);
      
      // Create a new ZipTrie instance
      const trie = new ZipTrie();
      
      // Load the data into the trie
      console.log(`Loading ${cleanedData.length} items into ZipTrie with fields:`, fieldsToIndex);
      trie.loadData(cleanedData, fieldsToIndex);
      
      // Store the cleaned data in memory
      userDataStore[userId] = {
        dataId,
        trie,
        rawData: cleanedData,
        searchFields: fieldsToIndex,
        returnFields: returnFields.length > 0 ? returnFields : fieldsToIndex,
        lastUpdated: new Date(),
        totalRecords: cleanedData.length
      };
      
      // Log the trie structure after loading
      console.log('=== ZIPTRIE STRUCTURE AFTER LOADING ===');
      debugZipTrie(trie);
      console.log('=== END ZIPTRIE STRUCTURE ===');
      
      // Verify the data was stored correctly
      console.log('Verifying data storage:');
      console.log(`- Raw data count: ${userDataStore[userId].rawData.length}`);
      console.log(`- Search fields: ${userDataStore[userId].searchFields}`);
      console.log(`- Sample search for 'f': ${JSON.stringify(trie.search('f', 2))}`);
      
      return NextResponse.json({
        success: true,
        message: 'Data stored successfully',
        dataId,
        recordCount: cleanedData.length,
        searchFields: fieldsToIndex
      });
    }
    
    // If we get here, the request was invalid
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your data', details: String(error) },
      { status: 500 }
    );
  }
}
