"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Flow, FlowNode, FlowConnection } from '@/types/flow';
import { v4 as uuidv4 } from 'uuid';
import { flowApi } from '@/services/api';
import { toast } from 'sonner';

interface FlowContextType {
  flow: Flow | null;
  loading: boolean;
  error: string | null;
  addNode: (node: Partial<FlowNode>) => void;
  updateNode: (id: string, data: Partial<FlowNode>) => void;
  removeNode: (id: string) => void;
  addConnection: (source: string, target: string) => void;
  removeConnection: (id: string) => void;
  loadFlow: (id: string) => Promise<void>;
  saveFlow: () => Promise<boolean>;
  createNewFlow: (name: string) => void;
  publishFlow: () => Promise<boolean>;
}

const defaultFlow: Flow = {
  id: '',
  name: 'New Flow',
  nodes: [
    {
      id: 'start',
      type: 'start',
      name: 'Start',
      position: { x: 100, y: 100 },
      data: {}
    }
  ],
  connections: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isPublished: false
};

const FlowContext = createContext<FlowContextType | undefined>(undefined);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addNode = useCallback((node: Partial<FlowNode>) => {
    setFlow((currentFlow) => {
      if (!currentFlow) return null;
      
      const newNode: FlowNode = {
        id: node.id || uuidv4(),
        type: node.type || 'message',
        name: node.name || 'New Node',
        position: node.position || { x: 200, y: 200 },
        data: node.data || {},
      };
      
      return {
        ...currentFlow,
        nodes: [...currentFlow.nodes, newNode],
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  const updateNode = useCallback((id: string, data: Partial<FlowNode>) => {
    setFlow((currentFlow) => {
      if (!currentFlow) return null;
      
      const nodes = currentFlow.nodes.map(node => 
        node.id === id ? { ...node, ...data } : node
      );
      
      return {
        ...currentFlow,
        nodes,
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  const removeNode = useCallback((id: string) => {
    setFlow((currentFlow) => {
      if (!currentFlow) return null;
      
      // Remove node
      const nodes = currentFlow.nodes.filter(node => node.id !== id);
      
      // Remove connections to/from this node
      const connections = currentFlow.connections.filter(
        conn => conn.source !== id && conn.target !== id
      );
      
      return {
        ...currentFlow,
        nodes,
        connections,
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  const addConnection = useCallback((source: string, target: string) => {
    setFlow((currentFlow) => {
      if (!currentFlow) return null;
      
      // Check if connection already exists
      const exists = currentFlow.connections.some(
        conn => conn.source === source && conn.target === target
      );
      
      if (exists) return currentFlow;
      
      const newConnection: FlowConnection = {
        id: uuidv4(),
        source,
        target
      };
      
      return {
        ...currentFlow,
        connections: [...currentFlow.connections, newConnection],
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  const removeConnection = useCallback((id: string) => {
    setFlow((currentFlow) => {
      if (!currentFlow) return null;
      
      const connections = currentFlow.connections.filter(conn => conn.id !== id);
      
      return {
        ...currentFlow,
        connections,
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  const loadFlow = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await flowApi.getFlow(id);
      setFlow(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load flow');
      toast.error('Error loading flow');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveFlow = useCallback(async (): Promise<boolean> => {
    if (!flow) return false;
    
    setLoading(true);
    setError(null);
    
    try {
      if (flow.id) {
        // Update existing flow
        await flowApi.updateFlow(flow.id, flow);
      } else {
        // Create new flow
        const response = await flowApi.createFlow(flow);
        setFlow(response.data);
      }
      
      toast.success('Flow saved successfully');
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save flow');
      toast.error('Error saving flow');
      return false;
    } finally {
      setLoading(false);
    }
  }, [flow]);

  const createNewFlow = useCallback((name: string) => {
    setFlow({
      ...defaultFlow,
      id: '',
      name: name || 'New Flow',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }, []);

  const publishFlow = useCallback(async (): Promise<boolean> => {
    if (!flow || !flow.id) {
      toast.error('Save the flow before publishing');
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await flowApi.publishFlow(flow.id);
      
      setFlow(currentFlow => 
        currentFlow ? { ...currentFlow, isPublished: true } : null
      );
      
      toast.success('Flow published successfully');
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to publish flow');
      toast.error('Error publishing flow');
      return false;
    } finally {
      setLoading(false);
    }
  }, [flow]);

  return (
    <FlowContext.Provider
      value={{
        flow,
        loading,
        error,
        addNode,
        updateNode,
        removeNode,
        addConnection,
        removeConnection,
        loadFlow,
        saveFlow,
        createNewFlow,
        publishFlow
      }}
    >
      {children}
    </FlowContext.Provider>
  );
}

export function useFlowContext() {
  const context = useContext(FlowContext);
  if (context === undefined) {
    throw new Error('useFlowContext must be used within a FlowProvider');
  }
  return context;
} 