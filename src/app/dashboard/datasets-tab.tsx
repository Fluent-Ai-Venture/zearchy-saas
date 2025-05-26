// src/app/dashboard/datasets-tab.tsx
"use client";

import { useState, useEffect } from 'react';

type Dataset = {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
};

export default function DatasetsTab() {
  // We'll use Clerk's user later when authentication is fully implemented
  // const { user } = useUser();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Used in handleSelectDataset
  const [, setSelectedDataset] = useState<string | null>(null);

  // Fetch datasets on component mount
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/datasets');
        
        if (!response.ok) {
          console.warn('Response not OK:', response.status);
          // Don't throw, just set empty datasets
          setDatasets([]);
          return;
        }
        
        const data = await response.json();
        console.log('Datasets response:', data);
        
        if (Array.isArray(data.datasets)) {
          setDatasets(data.datasets);
        } else {
          console.warn('Datasets is not an array:', data.datasets);
          setDatasets([]);
        }
        
        // Only set error if it's an actual error message
        // Clear any previous error if we successfully got datasets
        if (data.error) {
          setError(data.error);
        } else {
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching datasets:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setDatasets([]); // Always set datasets to empty array on error
      } finally {
        setLoading(false);
      }
    };
    
    fetchDatasets();
  }, []);

  // Clear cache for a specific dataset
  const clearCache = (datasetId: string) => {
    localStorage.removeItem(`ziptrie:${datasetId}`);
    alert('Cache cleared successfully');
  };

  // Delete a dataset
  const deleteDataset = async (datasetId: string) => {
    if (!confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`/api/datasets?id=${datasetId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete dataset');
      }
      
      // Remove from local storage
      localStorage.removeItem(`ziptrie:${datasetId}`);
      
      // Remove from state
      setDatasets(datasets.filter(d => d.id !== datasetId));
      
      // Show success message
      alert('Dataset deleted successfully');
      
      // If this was the selected dataset, clear the selection
      const selectedDataset = localStorage.getItem('selectedDataset');
      if (selectedDataset === datasetId) {
        localStorage.removeItem('selectedDataset');
      }
    } catch (err) {
      console.error('Error deleting dataset:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete dataset');
    } finally {
      setLoading(false);
    }
  };

  // Handle dataset selection
  const handleSelectDataset = (datasetId: string) => {
    setSelectedDataset(datasetId);
    // Store the selected dataset in localStorage for persistence
    localStorage.setItem('selectedDataset', datasetId);
    // Redirect to search page or update app state
    window.location.href = `/dashboard?tab=search&datasetId=${datasetId}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Only show error if it's not just a message about no datasets
  if (error && !error.includes('No datasets found')) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error:</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-black">Your Datasets</h2>
        <button 
          onClick={() => window.location.href = '/dashboard?tab=upload'}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Upload New Dataset
        </button>
      </div>

      {datasets.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
          <p className="text-gray-500">You don&apos;t have any datasets yet.</p>
          <button 
            onClick={() => window.location.href = '/dashboard?tab=upload'}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Upload Your First Dataset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets.map((dataset) => (
            <div 
              key={dataset.id} 
              className="border border-gray-200 rounded-md p-4 hover:shadow-md transition-shadow duration-200"
            >
              <h3 className="font-medium text-lg text-black">{dataset.name}</h3>
              <p className="text-sm text-gray-500">
                {new Date(dataset.createdAt).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-700 mt-2">
                {dataset.itemCount.toLocaleString()} items
              </p>
              
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={() => handleSelectDataset(dataset.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  Search
                </button>
                <button
                  onClick={() => clearCache(dataset.id)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
                >
                  Clear Cache
                </button>
                <button
                  onClick={() => deleteDataset(dataset.id)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
