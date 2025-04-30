"use client";

import { useState, useEffect, useRef } from 'react';
import { useFlowContext } from '@/hooks/useFlowContext';
import { FlowNode as FlowNodeType } from '@/types/flow';
import FlowNode from './FlowNode';
import FlowConnection from './FlowConnection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Plus, MessageSquare, GitBranchPlus, PenLine, Save, Play, Trash, ExternalLink } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function FlowEditor() {
  const { flow, addNode, updateNode, addConnection, saveFlow, publishFlow } = useFlowContext();
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [newFlowName, setNewFlowName] = useState('');
  const [isCreateNodeOpen, setIsCreateNodeOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Handle node click (for connections)
  const handleNodeClick = (node: FlowNodeType) => {
    if (!connectionStart) {
      // Start connection
      setConnectionStart(node.id);
    } else if (connectionStart !== node.id) {
      // Complete connection if not connecting to the same node
      addConnection(connectionStart, node.id);
      setConnectionStart(null);
    }
  };
  
  // Handle node drag
  const handleNodeDrag = (id: string, position: { x: number; y: number }) => {
    updateNode(id, { position });
  };
  
  // Handle background click to cancel connection
  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Only handle if clicked directly on the editor background
    if (e.target === e.currentTarget) {
      setConnectionStart(null);
    }
  };
  
  // Add a new node
  const handleAddNode = (type: 'message' | 'condition' | 'action' | 'end') => {
    const editorRect = editorRef.current?.getBoundingClientRect();
    
    if (editorRect) {
      const centerX = (editorRect.width / 2) - 128; // Half the node width
      const centerY = (editorRect.height / 2) - 80; // Half the node height
      
      addNode({
        type,
        name: `New ${type}`,
        position: { x: centerX, y: centerY },
        data: {}
      });
    }
    
    setIsCreateNodeOpen(false);
  };
  
  // Handle save flow
  const handleSaveFlow = async () => {
    const result = await saveFlow();
    if (result) {
      toast({
        title: 'Success',
        description: 'Flow saved successfully',
      });
    }
  };
  
  // Handle publish flow
  const handlePublishFlow = async () => {
    const result = await publishFlow();
    if (result) {
      toast({
        title: 'Success',
        description: 'Flow published successfully',
      });
    }
  };
  
  if (!flow) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <h2 className="text-center text-xl font-semibold mb-4">Create New Flow</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="flow-name">Flow Name</Label>
                <Input
                  id="flow-name"
                  placeholder="My New Flow"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => {
                  if (newFlowName.trim()) {
                    // Create a new flow
                  }
                }}
              >
                Create Flow
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b flex items-center justify-between bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{flow.name}</h2>
          {flow.isPublished && (
            <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2.5 py-0.5 rounded">
              Published
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={isCreateNodeOpen} onOpenChange={setIsCreateNodeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Add Node
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Node</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-2 items-center justify-center"
                  onClick={() => handleAddNode('message')}
                >
                  <MessageSquare className="h-6 w-6" />
                  <span>Message</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-2 items-center justify-center"
                  onClick={() => handleAddNode('condition')}
                >
                  <GitBranchPlus className="h-6 w-6" />
                  <span>Condition</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-2 items-center justify-center"
                  onClick={() => handleAddNode('action')}
                >
                  <PenLine className="h-6 w-6" />
                  <span>Action</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-2 items-center justify-center"
                  onClick={() => handleAddNode('end')}
                >
                  <ExternalLink className="h-6 w-6" />
                  <span>End</span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-1"
            onClick={handleSaveFlow}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          
          <Button
            variant="default"
            size="sm"
            className="flex items-center gap-1"
            onClick={handlePublishFlow}
            disabled={!flow.id}
          >
            <Play className="h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>
      
      {/* Editor area */}
      <div 
        ref={editorRef}
        className="flex-grow relative overflow-auto bg-slate-50 dark:bg-slate-900"
        onClick={handleBackgroundClick}
        style={{ minHeight: '500px' }}
      >
        {/* Grid background */}
        <div 
          className="absolute top-0 left-0 right-0 bottom-0"
          style={{
            backgroundImage: 'radial-gradient(circle, #64748b 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            opacity: 0.1,
          }}
        />
        
        {/* Connection indicator when making a connection */}
        {connectionStart && (
          <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
            <div className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm">
              Click on another node to connect
            </div>
          </div>
        )}
        
        {/* Render connections */}
        {flow.connections.map(connection => (
          <FlowConnection 
            key={connection.id} 
            connection={connection}
            nodes={flow.nodes}
          />
        ))}
        
        {/* Render nodes */}
        {flow.nodes.map(node => (
          <FlowNode
            key={node.id}
            node={node}
            onNodeClick={handleNodeClick}
            onNodeDrag={handleNodeDrag}
          />
        ))}
      </div>
    </div>
  );
} 