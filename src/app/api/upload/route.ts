// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db';
import { ZipTrie } from '@/lib/ziptrie';
import { createExportableZipTrie } from '@/lib/ziptrieExport';
import { parse as csvParse } from 'csv-parse/sync';
import { getAuth } from '@clerk/nextjs/server';

/**
 * Upload endpoint for processing CSV/JSON files and storing in database
 */
export async function POST(request: NextRequest) {
  console.log('Upload endpoint called');
  
  // Wrap the entire function in a try/catch to ensure we always return JSON
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
    
    console.log('User ID:', userId);
    
    // Try to get the form data
    console.log('Getting form data');
    let formData;
    try {
      formData = await request.formData();
      console.log('Form data received successfully');
    } catch (formError) {
      console.error('Error getting form data:', formError);
      return NextResponse.json({
        error: 'Failed to parse form data',
        details: String(formError)
      }, { status: 400 });
    }
    
    // Check if we got a file
    const file = formData.get('file') as File | null;
    if (!file) {
      console.error('No file provided in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Log file info
    console.log(`File received: ${file.name} (${file.size} bytes)`);
    
    // Generate a UUID for the dataset
    const datasetId = uuidv4();
    const datasetName = file.name.split('.')[0] || 'Unnamed Dataset';
    
    // Read file content as text
    let fileContent;
    try {
      fileContent = await file.text();
      console.log(`File content read: ${fileContent.length} characters`);
    } catch (readError) {
      console.error('Error reading file content:', readError);
      return NextResponse.json({
        error: 'Failed to read file content',
        details: String(readError)
      }, { status: 500 });
    }
    
    // Parse the file content based on type
    let parsedData: Record<string, unknown>[] = [];
    let allFields: string[] = [];
    
    try {
      if (file.name.endsWith('.csv')) {
        try {
          // Use the csv-parse library for proper CSV parsing with more robust options
          parsedData = csvParse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            cast: true,
            skip_records_with_error: true,
            relax_column_count: true, // Allow rows with inconsistent column counts
            relax_quotes: true, // Be more forgiving with quotes
            escape: '\\' // Use backslash as escape character
          });
          
          // Validate and clean the parsed data
          if (parsedData.length > 0) {
            // Get fields from the first row
            allFields = Object.keys(parsedData[0]);
            
            // Filter out any empty or invalid rows
            parsedData = parsedData.filter(row => {
              // Check if the row has at least one non-empty value
              return Object.values(row).some(val => 
                val !== null && val !== undefined && val !== ''
              );
            });
          }
          
          console.log(`Parsed CSV with ${parsedData.length} rows and ${allFields.length} fields`);
          console.log('Fields:', allFields);
        } catch (csvError) {
          console.error('CSV parsing error:', csvError);
          throw new Error(`Failed to parse CSV: ${csvError instanceof Error ? csvError.message : String(csvError)}`);
        }
      } else if (file.name.endsWith('.json')) {
        // Parse JSON data
        const jsonData = JSON.parse(fileContent);
        if (Array.isArray(jsonData)) {
          parsedData = jsonData;
        } else if (jsonData && typeof jsonData === 'object') {
          if ('data' in jsonData && Array.isArray(jsonData.data)) {
            parsedData = jsonData.data;
          } else {
            parsedData = [jsonData];
          }
        }
        
        if (parsedData.length > 0) {
          allFields = Object.keys(parsedData[0]);
        }
        console.log(`Parsed JSON with ${parsedData.length} items`);
      }
    } catch (parseError) {
      console.error('Error parsing file:', parseError);
      return NextResponse.json({
        error: 'Failed to parse file content',
        details: String(parseError)
      }, { status: 400 });
    }
    
    // Create a preview of the data (first 10 items)
    const previewData = parsedData.slice(0, 10);
    const totalRecords = parsedData.length;
    
    // Store data in the database
    try {
      console.log('Storing dataset in database...');
      
      // 1. Create the dataset record
      try {
        await prisma.dataset.create({
          data: {
            id: datasetId,
            userId: userId,
            name: datasetName,
          }
        });
        console.log('Dataset record created');
      } catch (error) {
        console.error('Error creating dataset record:', error);
        
        // Check for unique constraint violation (dataset might already exist)
        if (
          typeof error === 'object' && 
          error !== null && 
          'code' in error && 
          error.code === 'P2002'
        ) {
          return NextResponse.json({
            error: 'A dataset with this name already exists',
            details: 'Please use a different name for your dataset'
          }, { status: 409 });
        }
        
        throw new Error(`Database error: ${error instanceof Error ? error.message : 'Failed to create dataset record'}`);
      }
      
      // 2. Create a ZipTrie for search
      console.log('Creating ZipTrie with', parsedData.length, 'items and fields:', allFields);
      const trie = new ZipTrie();
      
      try {
        // Limit the data size for initial processing to avoid memory issues
        // We'll process the full dataset in batches if needed
        const maxInitialProcessingSize = 10000;
        const initialBatch = parsedData.slice(0, maxInitialProcessingSize);
        
        console.log(`Processing initial batch of ${initialBatch.length} records`);
        trie.loadData(initialBatch, allFields);
        
        // If we have more data, process it in batches
        if (parsedData.length > maxInitialProcessingSize) {
          console.log(`Processing remaining ${parsedData.length - maxInitialProcessingSize} records in batches`);
          
          const batchSize = 5000;
          for (let i = maxInitialProcessingSize; i < parsedData.length; i += batchSize) {
            const batch = parsedData.slice(i, Math.min(i + batchSize, parsedData.length));
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.length} records`);
            trie.loadData(batch, allFields, true); // true = batch mode
          }
        }
        
        console.log('ZipTrie created successfully');
      } catch (trieError) {
        console.error('Error creating ZipTrie:', trieError);
        throw new Error(`Failed to create search index: ${trieError instanceof Error ? trieError.message : String(trieError)}`);
      }
      
      // 3. Store the trie JSON in the database with proper serialized data
      console.log('Creating exportable ZipTrie for storage...');
      
      // Use the createExportableZipTrie helper function to create a trie with the data
      const exportableTrie = createExportableZipTrie(parsedData, allFields);
      
      // Create a map of product IDs to their data for the exportable trie
      const itemsMap: Record<string, Record<string, unknown>> = {};
      
      // Add each item to the map with its ID
      parsedData.forEach(item => {
        // Generate a stable ID for the item
        const id = uuidv4();
        itemsMap[id] = item;
      });
      
      // Export the trie to a serializable format
      const serializedTrie = exportableTrie.export();
      
      // Create the complete trie JSON with all necessary data
      const trieJson = {
        trie: JSON.parse(JSON.stringify(serializedTrie)),
        fields: allFields,
        recordCount: parsedData.length
      };
      
      try {
        await prisma.trie.create({
          data: {
            datasetId: datasetId,
            trieJson: trieJson,
          }
        });
        console.log('Trie record created with serialized data');
      } catch (error) {
        console.error('Error creating trie record:', error);
        throw new Error(`Database error: ${error instanceof Error ? error.message : 'Failed to create trie record'}`);
      }
      
      // 4. Store products in batches to avoid memory issues
      console.log(`Storing ${parsedData.length} products in database...`);
      
      try {
        // Process in batches of 100
        const batchSize = 100;
        let totalStored = 0;
        
        for (let i = 0; i < parsedData.length; i += batchSize) {
          // Process each item individually to avoid type issues
          const batchItems = parsedData.slice(i, i + batchSize);
          
          try {
            // Use a transaction for better performance and atomicity
            await prisma.$transaction(async (tx) => {
              for (const item of batchItems) {
                await tx.product.create({
                  data: {
                    id: uuidv4(),
                    datasetId: datasetId,
                    data: JSON.parse(JSON.stringify(item)), // Convert to a format Prisma can handle
                  }
                });
              }
            });
          } catch (error) {
            console.error(`Error storing batch ${i/batchSize + 1}:`, error);
            throw new Error(`Database error: Failed to store products batch ${i/batchSize + 1} - ${error instanceof Error ? error.message : String(error)}`);
          }
          
          totalStored += batchItems.length;
          console.log(`Progress: ${totalStored}/${parsedData.length} products stored (${Math.round(totalStored/parsedData.length*100)}%)`);
        }
        
        console.log('All products stored successfully');
      } catch (batchError) {
        console.error('Error during batch processing:', batchError);
        throw new Error(`Failed to store products: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({
        error: 'Failed to store data in database',
        details: String(dbError)
      }, { status: 500 });
    }
    
    // Prepare the response
    const responseData = {
      success: true,
      message: 'File processed and stored successfully',
      dataId: datasetId,
      data: previewData,
      allFields: allFields,
      totalRecords: totalRecords
    };
    
    // Log the response we're about to send
    console.log('Sending response:', JSON.stringify(responseData).substring(0, 200) + '...');
    
    // Return success response with explicit headers
    return new NextResponse(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    // Log and return any errors
    console.error('Upload error:', error);
    
    // Make sure we're always returning a proper JSON response with appropriate headers
    return new NextResponse(
      JSON.stringify({ 
        error: 'An error occurred while processing your file',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

// Error handler to ensure we always return JSON
export function onError(error: Error) {
  console.error('API route error handler:', error);
  return new NextResponse(
    JSON.stringify({
      error: 'Server error',
      details: error.message
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}
