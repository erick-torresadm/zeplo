export type NodeType = 'start' | 'message' | 'condition' | 'action' | 'end';

export interface FlowNode {
  id: string;
  type: NodeType;
  name: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    content?: string;
    mediaUrl?: string;
    caption?: string;
    delay?: number; // delay in milliseconds
    condition?: string;
  };
}

export interface FlowConnection {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  connections: FlowConnection[];
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  triggerKeyword?: string;
} 