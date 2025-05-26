# ZipTrie Search Platform

A high-performance, SaaS-based search platform utilizing the memory-efficient ZipTrie algorithm. This platform allows users to upload JSON/CSV data and perform ultra-fast, in-memory searches with exceptional speed and accuracy.

## Live Demo

[Try the ZipTrie Search Platform](https://zearchy-saas-bgosse-wesuite-bryant-gossetts-projects.vercel.app?_vercel_share=zpbGiYyXu7DoaXkuTlFJ2VsN4U9O4gJO)

> **Note:** The API functionality in the deployed preview is limited due to deployment protections. API key creation and API calls can be tested through Postman when running the app locally. These features would be fully available if deployed to a production environment with proper authentication configuration.

## API Documentation

### Authentication

All API endpoints require authentication using an API key. Include your API key in the `x-api-key` header with all requests.

```
headers: {
  'x-api-key': 'your_api_key_here'
}
```

### Endpoints

#### Search

```
GET /api/search?q=search_term&datasetId=your_dataset_id&limit=10
```

**Parameters:**
- `q` - The search query
- `datasetId` - The ID of the dataset to search
- `limit` (optional) - Maximum number of results to return (default: 10)

#### Retrieve ZipTrie Data

```
GET /api/trie/[datasetId]
```

This endpoint returns the complete ZipTrie data structure for a dataset, allowing you to perform client-side searches without making API calls for each search.

### Testing Locally

To test the API locally:

1. Run the development server: `npm run dev`
2. Create an API key through the dashboard
3. Use Postman or any API client to make requests to the endpoints

The ZipTrie algorithm is based on research published in ["ZipTrie: High-Performance Lexical Search for Big Data Applications"](https://arxiv.org/pdf/2505.04953).

### Dual-Mode Operation

**ZipTrie Search Platform** offers two powerful modes of operation:

1. **API-Based Search**: Fast, server-side search queries through RESTful API endpoints, ideal for web applications and services that need real-time search capabilities.

2. **Offline Local Search**: Download and use the ZipTrie data structure directly in your client applications for completely offline search functionality. This unique capability allows your applications to maintain search functionality even without internet connectivity.

## Features

- **Ultra-fast Search**: Powered by the proprietary ZipTrie algorithm
- **Data Upload**: Currently supports CSV file format (JSON support coming soon)
- **User Authentication**: Secure authentication via Clerk
- **API Access**: Comprehensive API with key management
- **Performance Metrics**: Real-time search performance statistics
- **Offline Search**: Download and cache ZipTrie data for completely offline client-side search functionality
- **Dataset Management**: Create, update, and delete datasets

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: PostgreSQL (for metadata only, not search data)
- **Authentication**: Clerk
- **Search Algorithm**: Custom ZipTrie implementation

## Prerequisites

- Node.js 18.x or higher
- PostgreSQL database
- Clerk account for authentication

## Environment Setup

1. Clone the repository
2. Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/zearchy"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Sample Data

To quickly test the platform's capabilities, you can use sample CSV files from the following repository (currently, only CSV format is supported):

[Sample CSV Files Repository](https://github.com/datablist/sample-csv-files)

**Recommendation**: Start with the [Organizations CSV with 100 records](https://github.com/datablist/sample-csv-files/blob/main/csv-files/organizations/organizations-100.csv). This dataset provides a good balance of size and complexity for initial testing.

**Note on Large Datasets**: The current version works best with datasets up to a few thousand records. Performance improvements for handling larger datasets are planned for future releases.

**Browser Storage**: The Local Search feature now uses IndexedDB for storing large datasets, with fallback to localStorage for older browsers. This allows for much larger datasets to be stored locally (up to 50-100MB depending on the browser). Data is automatically compressed to maximize storage efficiency.

1. Download the CSV file from the repository
2. Navigate to the Upload tab in the dashboard
3. Upload the CSV file
4. Configure the searchable fields (e.g., name, website, country)
5. Start searching!

## Installation

```bash
# Install dependencies
npm install

# Set up the database schema
npx prisma generate
npx prisma db push

# Start the development server
npm run dev
```

The `npx prisma db push` command creates the necessary database tables based on the schema defined in `prisma/schema.prisma`. This step is essential for the application to function properly, as it sets up tables for users, datasets, API keys, and other metadata.

## Database Setup

The application uses PostgreSQL for storing metadata (not the actual search data, which is kept in memory). Follow these steps to set up your database:

1. Create a PostgreSQL database named `zearchy`
2. Update the `DATABASE_URL` in your `.env` file with your database credentials
3. Run the Prisma commands to create the necessary tables:

```bash
npx prisma generate
npx prisma db push
```

## Authentication Setup

1. Create an account at [Clerk](https://clerk.dev/)
2. Create a new application in the Clerk dashboard
3. Configure the application with the following settings:
   - Enable Email/Password authentication
   - Set the redirect URLs to include your local development URL
4. Copy the API keys from the Clerk dashboard to your `.env` file

## Usage

### Dashboard Tabs Overview

#### Upload Tab
1. Navigate to the Upload tab in the dashboard
2. Select a CSV file to upload (currently only CSV format is supported, with JSON support planned for future releases)
3. Configure the searchable fields
4. Save the configuration

#### Search Tab (Server-Side Search)
1. Navigate to the Search tab
2. Enter your search query
3. View the results and performance metrics

**Note**: The Search tab makes API network calls to the server to perform searches. This provides the most up-to-date results but requires an internet connection.

#### Local Search Tab (Client-Side Search)
1. Navigate to the Local Search tab
2. Select a dataset from your available datasets
3. Enter your search query
4. View the results processed entirely in your browser

**Note**: The Local Search tab automatically uses the ZipTrie data already stored in your browser's localStorage to perform searches completely offline without making any network requests. There's also an option to download the ZipTrie data file if you want to use it elsewhere.

#### API Keys Tab
1. Navigate to the API Keys tab
2. Create a new API key
3. Use the key in your API requests as shown in the documentation

### Testing Offline Functionality

To verify the offline capabilities of the ZipTrie Search Platform:

1. Load the application and navigate to the Local Search tab
2. Select a dataset from your available datasets
3. Perform a search to ensure it works
4. Open your browser's Developer Tools (F12 or Right-click > Inspect)
5. Go to the Network tab in Developer Tools
6. Enable "Offline" mode (usually a checkbox or in the network conditions dropdown)
7. Try searching in both tabs:
   - The Search tab will fail to return results (showing a network error)
   - The Local Search tab will continue to function normally, using the data from localStorage

This demonstrates how the ZipTrie Search Platform can provide search functionality even when your application is completely offline.

## API Documentation

### Search Endpoint

```
GET /api/search?q=your_query&dataId=your_dataset_id
Header: x-api-key: your_api_key
```

### ZipTrie Data Endpoint

```
GET /api/trie?dataId=your_dataset_id
Header: x-api-key: your_api_key
```

## Offline Search Capabilities

One of the most powerful features of the ZipTrie Search Platform is its ability to function completely offline. This is achieved through the following mechanisms:

### How It Works

1. **Data Download**: The platform allows you to download the serialized ZipTrie data structure for any dataset you have access to.

2. **Local Storage**: The downloaded data is cached in the browser's localStorage, making it available even when offline.

3. **Client-Side Search**: The `ExportableZipTrie` class provides all the functionality needed to perform searches directly in the browser without any server requests.

4. **Automatic Synchronization**: When online, the platform can check for updates to the dataset and refresh the local cache as needed.

### Implementation

The platform includes a custom React hook (`useLocalZipTrie`) that manages the offline search functionality:

```typescript
// Example usage of offline search
import { useLocalZipTrie } from '@/hooks/useLocalZipTrie';

function SearchComponent({ datasetId }) {
  const { zipTrie, loading, error } = useLocalZipTrie(datasetId);
  
  const searchLocally = (query) => {
    if (zipTrie) {
      return zipTrie.search(query);
    }
    return [];
  };
  
  // Rest of your component...
}
```

This approach provides several benefits:

- **Reduced Server Load**: Offloads search operations to the client
- **Improved Performance**: Eliminates network latency for search operations
- **Offline Functionality**: Applications continue to work without internet connectivity
- **Reduced Bandwidth**: Only needs to download the dataset once

## Development

### Project Structure

- `/src/app` - Next.js application code
- `/src/app/api` - API routes
- `/src/app/dashboard` - Dashboard components
- `/src/lib` - Utility functions and ZipTrie implementation
- `/prisma` - Database schema and migrations

## Planned Improvements

The ZipTrie Search Platform is under active development. Here are some improvements planned for future releases:

1. **JSON Support**: Adding the ability to upload and process JSON files
2. **Large Dataset Performance**: Optimizing data upload and processing for datasets with tens of thousands of records
3. **Advanced Search Features**: Adding support for boolean operators (AND, OR, NOT) and fuzzy matching
4. **Client Libraries**: Creating standalone npm packages and framework-specific libraries for offline ZipTrie functionality
5. **Multi-language Support**: Extending the algorithm to work with non-Latin alphabets

## License

Proprietary - All rights reserved

## Support

For support, please contact support@zearchy.com
