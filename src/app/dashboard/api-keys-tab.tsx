'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
  key?: string; // Only present when first created or regenerated
}

export default function ApiKeysTab() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<{ id: string; key: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Fetch API keys on component mount
  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/keys');
      
      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }
      
      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch (err) {
      console.error('Error fetching API keys:', err);
      setError('Failed to load API keys. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      setError('Please enter a name for the API key');
      return;
    }
    
    try {
      setIsCreating(true);
      setError(null);
      
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newKeyName }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create API key');
      }
      
      const data = await response.json();
      
      // Store the newly created key to display to the user
      setNewKey({ id: data.id, key: data.key });
      
      // Reset form
      setNewKeyName('');
      
      // Refresh the list of API keys
      fetchApiKeys();
    } catch (err) {
      console.error('Error creating API key:', err);
      setError('Failed to create API key. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const regenerateApiKey = async (id: string) => {
    try {
      setIsRegenerating(true);
      setRegeneratingId(id);
      setError(null);
      
      const response = await fetch('/api/keys/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to regenerate API key');
      }
      
      const data = await response.json();
      
      // Store the regenerated key to display to the user
      setNewKey({ id: data.id, key: data.key });
      
      // Refresh the list of API keys
      fetchApiKeys();
    } catch (err) {
      console.error('Error regenerating API key:', err);
      setError('Failed to regenerate API key. Please try again.');
    } finally {
      setIsRegenerating(false);
      setRegeneratingId(null);
    }
  };

  const revokeApiKey = async (id: string) => {
    try {
      setError(null);
      
      const response = await fetch('/api/keys', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, isActive: false }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }
      
      // Refresh the list of API keys
      fetchApiKeys();
    } catch (err) {
      console.error('Error revoking API key:', err);
      setError('Failed to revoke API key. Please try again.');
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      setError(null);
      
      const response = await fetch(`/api/keys?id=${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }
      
      // Refresh the list of API keys
      fetchApiKeys();
    } catch (err) {
      console.error('Error deleting API key:', err);
      setError('Failed to delete API key. Please try again.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (err) {
      return `Invalid date: ${err}`;
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {newKey && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          <p className="font-medium">API Key created successfully!</p>
          <p className="mt-1">Please copy your API key now. It will not be shown again.</p>
          <div className="mt-2 bg-green-100 p-2 rounded font-mono break-all">
            {newKey.key}
          </div>
          <button 
            className="mt-2 text-sm text-green-700 hover:text-green-900"
            onClick={() => {
              navigator.clipboard.writeText(newKey.key);
              alert('API key copied to clipboard!');
            }}
          >
            Copy to clipboard
          </button>
          <button 
            className="mt-2 ml-4 text-sm text-green-700 hover:text-green-900"
            onClick={() => setNewKey(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      
      <div className="mb-6">
        <h3 className="text-lg font-medium text-black mb-2">Create New API Key</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="API Key Name"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => createApiKey()}
            disabled={isCreating || !newKeyName.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-1"
          >
            {isCreating ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin">↻</span>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <span className="inline-block h-4 w-4">+</span>
                <span>Create</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-black mb-2">Your API Keys</h3>
        
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
            <p>Loading API keys...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-8 rounded text-center">
            <p>You haven&apos;t created any API keys yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-black">{key.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      {formatDate(key.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      {formatDate(key.lastUsedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {key.isActive ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => regenerateApiKey(key.id)}
                          disabled={!key.isActive}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={key.isActive ? "Regenerate API Key" : "Cannot regenerate revoked key"}
                        >
                          {isRegenerating && regeneratingId === key.id ? (
                            <span className="inline-block h-5 w-5 animate-spin">↻</span>
                          ) : (
                            <span className="inline-block h-5 w-5">↻</span>
                          )}
                        </button>
                        
                        {key.isActive ? (
                          <button
                            onClick={() => revokeApiKey(key.id)}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="Revoke API Key"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => deleteApiKey(key.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete API Key"
                          >
                            <span className="inline-block h-5 w-5">🗑️</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold text-black mb-4">API Documentation</h2>
        
        <div className="prose max-w-none text-black">
          <p>
            Use your API key to access the ZipTrie search API programmatically. 
            Include your API key in the <code>x-api-key</code> header with all requests.
          </p>
          
          <h3>Search Endpoint</h3>
          <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto">
            <code>GET /api/search?q=search_term&datasetId=your_dataset_id&limit=10</code>
          </pre>
          
          <h4>Parameters:</h4>
          <ul>
            <li><code>q</code> - The search query</li>
            <li><code>datasetId</code> - The ID of the dataset to search</li>
            <li><code>limit</code> (optional) - Maximum number of results to return (default: 10)</li>
          </ul>
          
          <h3>Trie Data Endpoint</h3>
          <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto">
            <code>GET /api/trie/[datasetId]</code>
          </pre>
          
          <p>
            This endpoint returns the complete ZipTrie data structure for a dataset, 
            allowing you to perform client-side searches without making API calls for each search.
          </p>
          
          <h3>Example Usage (JavaScript)</h3>
          <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto">
            <code>{`// Search API example
const searchData = async (query, datasetId) => {
  const response = await fetch(
    \`/api/search?q=\${query}&datasetId=\${datasetId}\`,
    {
      headers: {
        'x-api-key': 'your_api_key_here'
      }
    }
  );
  
  return response.json();
};

// Trie data example
const getTrieData = async (datasetId) => {
  const response = await fetch(
    \`/api/trie/\${datasetId}\`,
    {
      headers: {
        'x-api-key': 'your_api_key_here'
      }
    }
  );
  
  return response.json();
};`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
