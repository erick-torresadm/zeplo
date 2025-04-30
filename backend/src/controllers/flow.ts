import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { flowManager } from '../services/flow-manager';
import { logError } from '../utils/logger';

export const flowController = {
  async getAllFlows(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const flows = await flowManager.getAllFlows(userId);
      return res.json(flows);
    } catch (error) {
      logError('Error getting all flows', error);
      res.status(500).json({ message: 'Error getting all flows' });
    }
  },

  async createFlow(req: AuthRequest, res: Response) {
    try {
      const { name, description, nodes, connections } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Create basic flow structure with start and end nodes
      const flow = await flowManager.createFlow({
        name,
        description,
        user_id: userId,
        is_draft: true
      });

      // If frontend provided nodes, use them, otherwise create default ones
      if (nodes && Array.isArray(nodes)) {
        for (const node of nodes) {
          await flowManager.createNode(flow.id, {
            type: node.type,
            name: node.name,
            position_x: node.position.x,
            position_y: node.position.y,
            data: node.data || {}
          });
        }
      } else {
        // Create start node
        await flowManager.createNode(flow.id, {
          type: 'start',
          name: 'Start',
          position_x: 100,
          position_y: 100,
          data: {}
        });

        // Create end node
        await flowManager.createNode(flow.id, {
          type: 'end',
          name: 'End',
          position_x: 500,
          position_y: 100,
          data: {}
        });
      }

      // Create connections if provided
      if (connections && Array.isArray(connections)) {
        for (const connection of connections) {
          await flowManager.createConnection({
            flow_id: flow.id,
            source_node_id: connection.source,
            target_node_id: connection.target,
            condition: connection.label,
            delay: 0
          });
        }
      }

      // Get the complete flow with nodes and connections
      const { nodes: createdNodes, connections: createdConnections } = await flowManager.getFlowStructure(flow.id);

      res.status(201).json({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        isPublished: !flow.is_draft,
        createdAt: flow.created_at,
        updatedAt: flow.updated_at,
        nodes: createdNodes,
        connections: createdConnections
      });
    } catch (error) {
      logError('Error creating flow', error);
      res.status(500).json({ message: 'Error creating flow' });
    }
  },

  async getFlow(req: AuthRequest, res: Response) {
    try {
      const flowId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const flow = await flowManager.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ message: 'Flow not found' });
      }

      if (flow.user_id !== userId) {
        return res.status(403).json({ message: 'Not authorized to access this flow' });
      }

      const { nodes, connections } = await flowManager.getFlowStructure(flow.id);

      return res.json({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        isPublished: !flow.is_draft,
        createdAt: flow.created_at,
        updatedAt: flow.updated_at,
        triggerKeyword: flow.trigger_value,
        nodes,
        connections
      });
    } catch (error) {
      logError('Error getting flow', error);
      res.status(500).json({ message: 'Error getting flow' });
    }
  },

  async updateFlow(req: AuthRequest, res: Response) {
    try {
      const flowId = parseInt(req.params.id);
      const { name, description, nodes, connections } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const flow = await flowManager.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ message: 'Flow not found' });
      }

      if (flow.user_id !== userId) {
        return res.status(403).json({ message: 'Not authorized to update this flow' });
      }

      // Update flow basic info
      const updatedFlow = await flowManager.updateFlow(flow.id, {
        name,
        description
      });

      // Update nodes
      if (nodes && Array.isArray(nodes)) {
        for (const node of nodes) {
          if (node.id) {
            await flowManager.updateNode(node.id, {
              name: node.name,
              type: node.type,
              position_x: node.position.x,
              position_y: node.position.y,
              data: node.data
            });
          } else {
            await flowManager.createNode(flow.id, {
              name: node.name,
              type: node.type,
              position_x: node.position.x,
              position_y: node.position.y,
              data: node.data || {}
            });
          }
        }
      }

      // Update connections
      if (connections && Array.isArray(connections)) {
        for (const connection of connections) {
          if (connection.id) {
            await flowManager.updateConnection(connection.id, {
              source_node_id: connection.source,
              target_node_id: connection.target,
              condition: connection.label,
              delay: 0
            });
          } else {
            await flowManager.createConnection({
              flow_id: flow.id,
              source_node_id: connection.source,
              target_node_id: connection.target,
              condition: connection.label,
              delay: 0
            });
          }
        }
      }

      // Validate flow structure
      await flowManager.validateFlow(flow.id);

      // Get updated structure
      const updatedStructure = await flowManager.getFlowStructure(flow.id);

      return res.json({
        id: updatedFlow.id,
        name: updatedFlow.name,
        description: updatedFlow.description,
        isPublished: !updatedFlow.is_draft,
        createdAt: updatedFlow.created_at,
        updatedAt: updatedFlow.updated_at,
        triggerKeyword: updatedFlow.trigger_value,
        ...updatedStructure
      });
    } catch (error) {
      logError('Error updating flow', error);
      res.status(500).json({ message: 'Error updating flow' });
    }
  },

  async deleteFlow(req: AuthRequest, res: Response) {
    try {
      const flowId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const flow = await flowManager.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ message: 'Flow not found' });
      }

      if (flow.user_id !== userId) {
        return res.status(403).json({ message: 'Not authorized to delete this flow' });
      }

      await flowManager.deleteFlow(flow.id);

      return res.status(204).send();
    } catch (error) {
      logError('Error deleting flow', error);
      res.status(500).json({ message: 'Error deleting flow' });
    }
  },

  async publishFlow(req: AuthRequest, res: Response) {
    try {
      const flowId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const flow = await flowManager.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ message: 'Flow not found' });
      }

      if (flow.user_id !== userId) {
        return res.status(403).json({ message: 'Not authorized to publish this flow' });
      }

      // Validate flow before publishing
      await flowManager.validateFlow(flow.id);

      // Update flow status
      const publishedFlow = await flowManager.updateFlow(flow.id, {
        is_draft: false,
        version: flow.version ? 
          (parseFloat(flow.version) + 0.1).toFixed(1) : 
          '1.0'
      });

      return res.json({
        id: publishedFlow.id,
        name: publishedFlow.name,
        description: publishedFlow.description,
        isPublished: !publishedFlow.is_draft,
        createdAt: publishedFlow.created_at,
        updatedAt: publishedFlow.updated_at,
        triggerKeyword: publishedFlow.trigger_value,
        version: publishedFlow.version
      });
    } catch (error) {
      logError('Error publishing flow', error);
      res.status(500).json({ message: 'Error publishing flow' });
    }
  }
};

export default flowController; 