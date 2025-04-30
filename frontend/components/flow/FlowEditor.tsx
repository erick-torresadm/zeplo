import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Plus, MessageSquare, Image, Music, Video, File } from "lucide-react";
import { FlowNode, Flow, FlowConnection, NodeType } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { flowApi } from "@/lib/api";
import { toast } from "sonner";

// Node Types Configuration
const NODE_TYPES: Record<NodeType, { icon: React.ReactNode; label: string }> = {
  start: { icon: <Plus size={20} />, label: "Start" },
  text: { icon: <MessageSquare size={20} />, label: "Text" },
  image: { icon: <Image size={20} />, label: "Image" },
  audio: { icon: <Music size={20} />, label: "Audio" },
  video: { icon: <Video size={20} />, label: "Video" },
  document: { icon: <File size={20} />, label: "Document" },
};

interface FlowEditorProps {
  flowId?: string;
  onSave?: (flow: Flow) => void;
}

export default function FlowEditor({ flowId, onSave }: FlowEditorProps) {
  const [flow, setFlow] = useState<Flow>({
    id: flowId || uuidv4(),
    name: "Untitled Flow",
    nodes: [],
    connections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublished: false,
  });

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentConnection, setCurrentConnection] = useState<{
    source: string;
    sourcePos: { x: number; y: number };
    targetPos: { x: number; y: number };
  } | null>(null);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Record<string, HTMLDivElement>>({});

  // Fetch flow data if flowId is provided
  useEffect(() => {
    if (flowId) {
      fetchFlow();
    } else {
      // Create a start node if this is a new flow
      createNode("start", { x: 100, y: 100 });
    }
  }, [flowId]);

  const fetchFlow = async () => {
    try {
      const response = await flowApi.getFlow(flowId!);
      setFlow(response.data);
    } catch (error) {
      toast.error("Failed to load flow");
    }
  };

  const createNode = (type: NodeType, position: { x: number; y: number }) => {
    const newNode: FlowNode = {
      id: uuidv4(),
      type,
      position,
      data: {
        content: type === "start" ? "Start" : "",
      },
    };

    setFlow((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));

    return newNode;
  };

  const updateNodePosition = (id: string, position: { x: number; y: number }) => {
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === id ? { ...node, position } : node
      ),
    }));
  };

  const updateNodeData = (id: string, data: Partial<FlowNode["data"]>) => {
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    }));
  };

  const removeNode = (id: string) => {
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((node) => node.id !== id),
      connections: prev.connections.filter(
        (conn) => conn.source !== id && conn.target !== id
      ),
    }));
    setSelectedNode(null);
  };

  const addConnection = (source: string, target: string) => {
    // Don't allow connections to self or duplicate connections
    if (
      source === target ||
      flow.connections.some(
        (conn) => conn.source === source && conn.target === target
      )
    ) {
      return;
    }

    const newConnection: FlowConnection = {
      id: uuidv4(),
      source,
      target,
    };

    setFlow((prev) => ({
      ...prev,
      connections: [...prev.connections, newConnection],
    }));
  };

  const removeConnection = (id: string) => {
    setFlow((prev) => ({
      ...prev,
      connections: prev.connections.filter((conn) => conn.id !== id),
    }));
  };

  const handleNodeMouseDown = (
    e: React.MouseEvent,
    nodeId: string,
    isConnector = false
  ) => {
    if (isConnector) {
      e.stopPropagation();
      const node = flow.nodes.find((n) => n.id === nodeId);
      if (node) {
        const rect = nodesRef.current[nodeId].getBoundingClientRect();
        const editorRect = editorRef.current!.getBoundingClientRect();
        
        const sourcePos = {
          x: rect.left - editorRect.left + rect.width / 2,
          y: rect.top - editorRect.top + rect.height,
        };
        
        setCurrentConnection({
          source: nodeId,
          sourcePos,
          targetPos: { x: e.clientX - editorRect.left, y: e.clientY - editorRect.top },
        });
      }
    } else {
      setIsDragging(true);
      setSelectedNode(nodeId);
    }
  };

  const handleNodeMouseUp = (e: React.MouseEvent, nodeId: string) => {
    if (currentConnection && currentConnection.source !== nodeId) {
      addConnection(currentConnection.source, nodeId);
    }
    setCurrentConnection(null);
  };

  const handleEditorMouseUp = () => {
    setIsDragging(false);
    setCurrentConnection(null);
  };

  const handleEditorMouseMove = (e: React.MouseEvent) => {
    if (currentConnection && editorRef.current) {
      const rect = editorRef.current.getBoundingClientRect();
      setCurrentConnection({
        ...currentConnection,
        targetPos: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
      });
    }
  };

  const handleAddNode = (type: NodeType) => {
    // Find a free position (simple logic for demo)
    const lastNode = flow.nodes[flow.nodes.length - 1];
    const position = {
      x: lastNode ? lastNode.position.x + 50 : 150,
      y: lastNode ? lastNode.position.y + 120 : 150,
    };
    
    const newNode = createNode(type, position);
    setSelectedNode(newNode.id);
  };

  const handleSave = async () => {
    try {
      let response;
      if (flowId) {
        response = await flowApi.updateFlow(flowId, flow);
      } else {
        response = await flowApi.createFlow(flow);
      }
      
      if (onSave) {
        onSave(response.data);
      }
      
      toast.success("Flow saved successfully");
    } catch (error) {
      toast.error("Failed to save flow");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b">
        <input
          type="text"
          value={flow.name}
          onChange={(e) => setFlow({ ...flow, name: e.target.value })}
          className="text-lg font-medium bg-transparent outline-none border-none focus:ring-0"
          placeholder="Untitled Flow"
        />
        <div className="flex gap-2">
          <Button onClick={handleSave} size="sm">
            Save
          </Button>
          {!flow.isPublished && (
            <Button
              onClick={async () => {
                try {
                  await flowApi.publishFlow(flow.id);
                  setFlow((prev) => ({ ...prev, isPublished: true }));
                  toast.success("Flow published successfully");
                } catch (error) {
                  toast.error("Failed to publish flow");
                }
              }}
              variant="outline"
              size="sm"
            >
              Publish
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r p-4 flex flex-col gap-2">
          <h3 className="text-sm font-medium mb-2">Add Node</h3>
          {Object.entries(NODE_TYPES).map(([type, config]) => (
            type !== "start" && (
              <Button
                key={type}
                variant="outline"
                className="justify-start"
                onClick={() => handleAddNode(type as NodeType)}
              >
                <span className="mr-2">{config.icon}</span>
                {config.label}
              </Button>
            )
          ))}
        </div>
        
        <div
          ref={editorRef}
          className="flex-1 bg-grid-pattern relative overflow-auto"
          onMouseMove={handleEditorMouseMove}
          onMouseUp={handleEditorMouseUp}
        >
          {/* Nodes */}
          {flow.nodes.map((node) => (
            <motion.div
              key={node.id}
              ref={(el) => {
                if (el) nodesRef.current[node.id] = el;
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`absolute w-64 rounded-lg ${
                selectedNode === node.id ? "ring-2 ring-blue-500" : ""
              }`}
              style={{
                left: node.position.x,
                top: node.position.y,
                zIndex: selectedNode === node.id ? 10 : 1,
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onMouseUp={(e) => handleNodeMouseUp(e, node.id)}
              drag={selectedNode === node.id}
              dragMomentum={false}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={(_, info) => {
                updateNodePosition(node.id, {
                  x: node.position.x + info.offset.x,
                  y: node.position.y + info.offset.y,
                });
                setIsDragging(false);
              }}
            >
              <div className={`p-3 rounded-t-lg flex justify-between items-center ${
                node.type === "start" ? "bg-black text-white" : "bg-gray-100"
              }`}>
                <div className="flex items-center">
                  <span className="mr-2">{NODE_TYPES[node.type].icon}</span>
                  <span>{NODE_TYPES[node.type].label}</span>
                </div>
                {node.type !== "start" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNode(node.id);
                    }}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <div className="bg-white p-3 rounded-b-lg shadow-sm border border-gray-200">
                {node.type === "text" && (
                  <textarea
                    value={node.data.content}
                    onChange={(e) => updateNodeData(node.id, { content: e.target.value })}
                    className="w-full border rounded p-2 text-sm min-h-[80px]"
                    placeholder="Enter message text..."
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                
                {(node.type === "image" || node.type === "video" || node.type === "audio" || node.type === "document") && (
                  <>
                    <input
                      type="text"
                      value={node.data.mediaUrl || ""}
                      onChange={(e) => updateNodeData(node.id, { mediaUrl: e.target.value })}
                      className="w-full border rounded p-2 text-sm mb-2"
                      placeholder="Media URL..."
                      onClick={(e) => e.stopPropagation()}
                    />
                    <textarea
                      value={node.data.caption || ""}
                      onChange={(e) => updateNodeData(node.id, { caption: e.target.value })}
                      className="w-full border rounded p-2 text-sm min-h-[50px]"
                      placeholder="Caption (optional)..."
                      onClick={(e) => e.stopPropagation()}
                    />
                  </>
                )}
                
                {node.type !== "start" && (
                  <div className="mt-2 flex items-center">
                    <span className="text-xs text-gray-500 mr-2">Delay:</span>
                    <input
                      type="number"
                      value={node.data.delay || 0}
                      onChange={(e) => updateNodeData(node.id, { delay: parseInt(e.target.value) })}
                      className="w-20 border rounded p-1 text-sm"
                      min="0"
                      max="3600000"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-gray-500 ml-1">ms</span>
                  </div>
                )}
              </div>
              
              {/* Connector point */}
              <div
                className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 cursor-pointer z-20"
                onMouseDown={(e) => handleNodeMouseDown(e, node.id, true)}
              />
            </motion.div>
          ))}
          
          {/* Connections */}
          <svg className="absolute inset-0 pointer-events-none">
            {flow.connections.map((conn) => {
              const sourceNode = flow.nodes.find((n) => n.id === conn.source);
              const targetNode = flow.nodes.find((n) => n.id === conn.target);
              
              if (!sourceNode || !targetNode) return null;
              
              const sourceX = sourceNode.position.x + 128; // middle of the node
              const sourceY = sourceNode.position.y + 80; // approximation for the bottom
              const targetX = targetNode.position.x + 128; // middle of the node
              const targetY = targetNode.position.y; // top of the node
              
              // Create a curved path
              const path = `M${sourceX},${sourceY} C${sourceX},${sourceY + 50} ${targetX},${targetY - 50} ${targetX},${targetY}`;
              
              return (
                <g key={conn.id}>
                  <path
                    d={path}
                    stroke="#888"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                  {/* Invisible wider path for easier click detection */}
                  <path
                    d={path}
                    stroke="transparent"
                    strokeWidth="10"
                    fill="none"
                    onClick={() => removeConnection(conn.id)}
                    className="cursor-pointer"
                    pointerEvents="all"
                  />
                </g>
              );
            })}
            
            {/* Current connection being drawn */}
            {currentConnection && (
              <path
                d={`M${currentConnection.sourcePos.x},${currentConnection.sourcePos.y} C${
                  currentConnection.sourcePos.x
                },${currentConnection.sourcePos.y + 50} ${
                  currentConnection.targetPos.x
                },${currentConnection.targetPos.y - 50} ${
                  currentConnection.targetPos.x
                },${currentConnection.targetPos.y}`}
                stroke="#888"
                strokeWidth="2"
                strokeDasharray="5,5"
                fill="none"
              />
            )}
            
            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
} 