"use client";

import { useState } from 'react';
import { FlowNode as FlowNodeType, NodeType } from '@/types/flow';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFlowContext } from '@/hooks/useFlowContext';
import { Label } from '@/components/ui/label';
import { GripIcon, Pencil, Trash2, FileImage, MessageSquare, Clock } from 'lucide-react';

interface NodeProps {
  node: FlowNodeType;
  onNodeClick: (node: FlowNodeType) => void;
  onNodeDrag: (id: string, position: { x: number; y: number }) => void;
}

export default function FlowNode({ node, onNodeClick, onNodeDrag }: NodeProps) {
  const { updateNode, removeNode } = useFlowContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: node.name,
    content: node.data.content || '',
    mediaUrl: node.data.mediaUrl || '',
    delay: node.data.delay || 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };

  // Handle dragging
  const handleDrag = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const newPosition = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    };
    
    onNodeDrag(node.id, newPosition);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  // Handle dialog save
  const handleSave = () => {
    updateNode(node.id, {
      name: editData.name,
      data: {
        ...node.data,
        content: editData.content,
        mediaUrl: editData.mediaUrl,
        delay: editData.delay,
      }
    });
    setIsEditing(false);
  };

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'start':
        return <div className="bg-green-500 rounded-full w-4 h-4" />;
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'condition':
        return <div className="border-2 border-blue-500 transform rotate-45 w-4 h-4" />;
      case 'action':
        return <div className="bg-purple-500 rounded w-4 h-4" />;
      case 'end':
        return <div className="bg-red-500 rounded-full w-4 h-4" />;
      default:
        return null;
    }
  };

  const getBgColorByType = (type: NodeType) => {
    switch (type) {
      case 'start': return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
      case 'message': return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
      case 'condition': return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
      case 'action': return 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800';
      case 'end': return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
      default: return 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <>
      <div
        className="absolute"
        style={{
          transform: `translate(${node.position.x}px, ${node.position.y}px)`,
          zIndex: isDragging ? 1000 : 1,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <Card 
          className={`w-64 shadow-md select-none ${getBgColorByType(node.type)}`}
          onClick={() => onNodeClick(node)}
        >
          <div 
            className="absolute top-0 right-0 left-0 h-6 flex items-center justify-center cursor-grab bg-black/5 rounded-t-lg"
            onMouseDown={handleDragStart}
          >
            <GripIcon className="w-4 h-4 text-gray-500" />
          </div>
          
          <CardHeader className="pt-8 pb-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {getNodeIcon(node.type)}
                <CardTitle className="text-sm font-medium">{node.name}</CardTitle>
              </div>
              
              <div className="flex items-center gap-1">
                <Dialog open={isEditing} onOpenChange={setIsEditing}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="p-1 h-7 w-7">
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit {node.type} Node</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Node Name</Label>
                        <Input
                          id="name"
                          value={editData.name}
                          onChange={(e) => setEditData({...editData, name: e.target.value})}
                        />
                      </div>
                      
                      {node.type !== 'start' && node.type !== 'end' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="content">Content</Label>
                            <Input
                              id="content"
                              value={editData.content}
                              onChange={(e) => setEditData({...editData, content: e.target.value})}
                            />
                          </div>
                          
                          {node.type === 'message' && (
                            <div className="space-y-2">
                              <Label htmlFor="mediaUrl">Media URL</Label>
                              <Input
                                id="mediaUrl"
                                value={editData.mediaUrl}
                                onChange={(e) => setEditData({...editData, mediaUrl: e.target.value})}
                              />
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <Label htmlFor="delay">Delay (seconds)</Label>
                            <Input
                              id="delay"
                              type="number"
                              value={editData.delay}
                              onChange={(e) => setEditData({...editData, delay: parseInt(e.target.value) || 0})}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSave}>Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                {node.type !== 'start' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-1 h-7 w-7"
                    onClick={() => removeNode(node.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          {(node.data.content || node.data.mediaUrl || node.data.delay) && (
            <CardContent className="pb-2 pt-0">
              {node.data.content && (
                <div className="flex gap-2 text-xs mb-1">
                  <MessageSquare className="w-3 h-3 mt-0.5" />
                  <span className="truncate">{node.data.content}</span>
                </div>
              )}
              
              {node.data.mediaUrl && (
                <div className="flex gap-2 text-xs mb-1">
                  <FileImage className="w-3 h-3 mt-0.5" />
                  <span className="truncate">{node.data.mediaUrl}</span>
                </div>
              )}
              
              {node.data.delay && node.data.delay > 0 && (
                <div className="flex gap-2 text-xs">
                  <Clock className="w-3 h-3 mt-0.5" />
                  <span>{node.data.delay}s delay</span>
                </div>
              )}
            </CardContent>
          )}
          
          <CardFooter className="pt-2 pb-2">
            <div className="w-full flex justify-between text-xs text-gray-500">
              <span>ID: {node.id.substring(0, 6)}</span>
              <span>Type: {node.type}</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
} 