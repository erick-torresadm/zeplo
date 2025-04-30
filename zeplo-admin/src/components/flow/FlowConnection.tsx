"use client";

import { FlowConnection as FlowConnectionType, FlowNode } from '@/types/flow';
import { useFlowContext } from '@/hooks/useFlowContext';
import { Trash2 } from 'lucide-react';

interface ConnectionProps {
  connection: FlowConnectionType;
  nodes: FlowNode[];
}

export default function FlowConnection({ connection, nodes }: ConnectionProps) {
  const { removeConnection } = useFlowContext();
  
  // Find the source and target nodes
  const sourceNode = nodes.find(node => node.id === connection.source);
  const targetNode = nodes.find(node => node.id === connection.target);
  
  if (!sourceNode || !targetNode) {
    return null;
  }
  
  // Calculate the center positions
  const sourceX = sourceNode.position.x + 128; // Half of the card width (256/2)
  const sourceY = sourceNode.position.y + 80; // Approximate center of card
  const targetX = targetNode.position.x + 128;
  const targetY = targetNode.position.y + 80;
  
  // Calculate path
  const path = generateSmoothPath(sourceX, sourceY, targetX, targetY);
  
  // Calculate midpoint for the delete button
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  
  // Calculate the angle of the line for the arrowhead
  const angle = Math.atan2(targetY - sourceY, targetX - sourceX) * (180 / Math.PI);
  
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {/* SVG container */}
      <svg 
        width="100%" 
        height="100%" 
        className="absolute top-0 left-0"
        style={{ zIndex: 0 }}
      >
        {/* Connection path */}
        <path
          d={path}
          stroke="rgb(100, 116, 139)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="0"
          className="connection-path"
          markerEnd="url(#arrowhead)"
        />
        
        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="rgb(100, 116, 139)"
            />
          </marker>
        </defs>
      </svg>
      
      {/* Delete button */}
      <div 
        className="absolute bg-white dark:bg-gray-800 rounded-full shadow-md flex items-center justify-center p-1 cursor-pointer pointer-events-auto"
        style={{ 
          left: midX - 8, 
          top: midY - 8,
          zIndex: 10
        }}
        onClick={() => removeConnection(connection.id)}
      >
        <Trash2 className="h-3 w-3 text-red-500" />
      </div>
      
      {/* Connection label */}
      {connection.label && (
        <div 
          className="absolute bg-white dark:bg-gray-800 px-2 py-0.5 rounded text-xs shadow-sm pointer-events-auto"
          style={{ 
            left: midX, 
            top: midY - 20,
            transform: 'translateX(-50%)',
            zIndex: 10
          }}
        >
          {connection.label}
        </div>
      )}
    </div>
  );
}

// Helper function to generate a smooth curved path
function generateSmoothPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  // Calculate the distance and midpoint
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const midX = sourceX + dx * 0.5;
  const midY = sourceY + dy * 0.5;
  
  // Calculate control point offsets based on distance
  const offset = Math.min(Math.abs(dx), Math.abs(dy)) * 0.5;
  const controlX1 = sourceX + Math.sign(dx) * offset;
  const controlY1 = sourceY;
  const controlX2 = targetX - Math.sign(dx) * offset;
  const controlY2 = targetY;
  
  // Create a cubic bezier curve
  return `M ${sourceX} ${sourceY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${targetX} ${targetY}`;
} 