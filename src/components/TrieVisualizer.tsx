// src/components/TrieVisualizer.tsx
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { TrieVisualizationNode } from '@/lib/ziptrie';

interface TrieVisualizerProps {
  treeData: TrieVisualizationNode | null;
  searchPath: TrieVisualizationNode[] | null;
  searchQuery: string;
}

const TrieVisualizer: React.FC<TrieVisualizerProps> = ({ treeData, searchPath, searchQuery }) => {
  // Store expanded node paths as an array of strings instead of a Set
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  
  // Reset expanded nodes when search query changes
  useEffect(() => {
    if (searchPath && searchPath.length > 0) {
      const newExpandedNodes: string[] = [];
      let path = '';
      
      // Expand all nodes in the search path
      for (const node of searchPath) {
        path += node.char;
        newExpandedNodes.push(path);
      }
      
      setExpandedNodes(newExpandedNodes);
    }
  }, [searchQuery, searchPath]);
  
  // Check if a node is expanded
  const isNodeExpanded = useCallback((nodePath: string): boolean => {
    return expandedNodes.includes(nodePath);
  }, [expandedNodes]);
  
  // Toggle node expansion - only expand, don't collapse when clicking
  const toggleNode = useCallback((nodePath: string) => {
    // If node is not already expanded, add it
    if (!isNodeExpanded(nodePath)) {
      setExpandedNodes(prev => [...prev, nodePath]);
    }
  }, [isNodeExpanded]);
  
  // Explicitly close a node
  const closeNode = useCallback((nodePath: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent div's onClick
    setExpandedNodes(prev => prev.filter(path => path !== nodePath));
  }, []);
  
  // Check if a node is in the current search path
  const isInSearchPath = useCallback((nodePath: string, nodeChar: string): boolean => {
    if (!searchPath) return false;
    
    let currentPath = '';
    for (const node of searchPath) {
      currentPath += node.char;
      if (currentPath === nodePath && node.char === nodeChar) {
        return true;
      }
    }
    
    return false;
  }, [searchPath]);
  
  // Render a single node
  const renderNode = useCallback((node: TrieVisualizationNode, path: string = '', depth: number = 0) => {
    const nodePath = path + node.char;
    const isExpanded = isNodeExpanded(nodePath);
    const isHighlighted = isInSearchPath(nodePath, node.char);
    
    return (
      <div key={nodePath} style={{ marginLeft: `${depth * 20}px` }}>
        <div 
          className={`flex items-center py-1 px-2 rounded hover:bg-gray-100 ${isHighlighted ? 'bg-gray-200 font-bold' : ''} cursor-pointer`}
          onClick={() => toggleNode(nodePath)}
        >
          {node.children.length > 0 && (
            <span className="mr-2 text-black cursor-pointer">
              {isExpanded ? '▼' : '►'}
            </span>
          )}
          {isExpanded && node.children.length > 0 && (
            <span 
              className="ml-1 mr-2 text-xs text-gray-500 hover:text-red-500 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-200"
              onClick={(e) => closeNode(nodePath, e)}
              title="Close this node"
            >
              ✕
            </span>
          )}
          <span className={`${node.char ? 'px-2 py-1 border rounded-md mr-2' : 'mr-2'} ${isHighlighted ? 'border-black bg-gray-300 text-black' : 'border-gray-500 text-black'}`}>
            {node.char || 'root'}
          </span>
          {node.isEndOfWord && (
            <span className="text-xs bg-green-700 text-white px-2 py-1 rounded-full mr-2">
              End
            </span>
          )}
          {node.itemCount > 0 && (
            <span className="text-xs bg-blue-700 text-white px-2 py-1 rounded-full">
              {node.itemCount} items
            </span>
          )}
        </div>
        
        {isExpanded && node.children.map(child => renderNode(child, nodePath, depth + 1))}
      </div>
    );
  }, [isNodeExpanded, isInSearchPath, toggleNode, closeNode]);
  
  if (!treeData) {
    return <div className="text-black italic">No data available for visualization</div>;
  }
  
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white overflow-auto max-h-96">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-black flex items-center">
          ZipTrie Structure
          {searchQuery && (
            <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Search: &quot;{searchQuery}&quot;
            </span>
          )}
        </h3>
        <div className="text-xs text-gray-500">
          Click nodes to expand. Use ✕ to collapse.
        </div>
      </div>
      
      <div className="text-sm">
        {renderNode(treeData)}
      </div>
    </div>
  );
};

export default TrieVisualizer;
