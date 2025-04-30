import { Knex } from 'knex';
import db from '../config/database';
import { logError } from '../utils/logger';

export interface Flow {
  id: number;
  name: string;
  description: string;
  user_id: number;
  is_draft: boolean;
  version?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface FlowNode {
  id: number;
  flow_id: number;
  type: 'start' | 'message' | 'condition' | 'action' | 'end';
  name: string;
  data: Record<string, any>;
  position_x: number;
  position_y: number;
}

export interface FlowConnection {
  id: number;
  flow_id: number;
  source_node_id: number;
  target_node_id: number;
  condition?: string;
  delay: number;
}

export class FlowManager {
  private db: Knex;

  constructor() {
    this.db = db;
  }

  // Métodos de gerenciamento de fluxos
  async createFlow(flow: Partial<Flow>): Promise<Flow> {
    try {
      const [createdFlow] = await this.db('flows')
        .insert(flow)
        .returning('*');

      return createdFlow;
    } catch (error) {
      logError('Error creating flow', error);
      throw error;
    }
  }

  async getFlow(flowId: number): Promise<Flow | null> {
    try {
      const flow = await this.db('flows')
        .where({ id: flowId })
        .first();

      return flow || null;
    } catch (error) {
      logError('Error getting flow', error);
      throw error;
    }
  }

  async getAllFlows(userId: number | undefined): Promise<Flow[]> {
    try {
      let query = this.db('flows');
      
      if (userId) {
        query = query.where({ user_id: userId });
      }
      
      return await query.orderBy('created_at', 'desc');
    } catch (error) {
      logError('Error getting all flows', error);
      throw error;
    }
  }

  async updateFlow(flowId: number, flow: Partial<Flow>): Promise<Flow> {
    try {
      const [updatedFlow] = await this.db('flows')
        .where({ id: flowId })
        .update({
          ...flow,
          updated_at: new Date()
        })
        .returning('*');

      return updatedFlow;
    } catch (error) {
      logError('Error updating flow', error);
      throw error;
    }
  }

  async deleteFlow(flowId: number): Promise<void> {
    try {
      // Começar uma transação
      await this.db.transaction(async (trx) => {
        // Primeiro, excluir as conexões relacionadas
        await trx('flow_connections')
          .where({ flow_id: flowId })
          .delete();
        
        // Em seguida, excluir os nós do fluxo
        await trx('flow_nodes')
          .where({ flow_id: flowId })
          .delete();
        
        // Por fim, excluir o próprio fluxo
        await trx('flows')
          .where({ id: flowId })
          .delete();
      });
    } catch (error) {
      logError('Error deleting flow', error);
      throw error;
    }
  }

  // Métodos de gerenciamento de nós (nodes)
  async createNode(flowId: number, node: Partial<FlowNode>): Promise<FlowNode> {
    try {
      const [createdNode] = await this.db('flow_nodes')
        .insert({
          ...node,
          flow_id: flowId,
        })
        .returning('*');

      return createdNode;
    } catch (error) {
      logError('Error creating flow node', error);
      throw error;
    }
  }

  async updateNode(nodeId: number, node: Partial<FlowNode>): Promise<FlowNode> {
    try {
      const [updatedNode] = await this.db('flow_nodes')
        .where({ id: nodeId })
        .update(node)
        .returning('*');

      return updatedNode;
    } catch (error) {
      logError('Error updating flow node', error);
      throw error;
    }
  }

  async deleteNode(nodeId: number): Promise<void> {
    try {
      await this.db('flow_nodes')
        .where({ id: nodeId })
        .delete();
    } catch (error) {
      logError('Error deleting flow node', error);
      throw error;
    }
  }

  async createConnection(connection: Partial<FlowConnection>): Promise<FlowConnection> {
    try {
      const [createdConnection] = await this.db('flow_connections')
        .insert(connection)
        .returning('*');

      return createdConnection;
    } catch (error) {
      logError('Error creating flow connection', error);
      throw error;
    }
  }

  async updateConnection(connectionId: number, connection: Partial<FlowConnection>): Promise<FlowConnection> {
    try {
      const [updatedConnection] = await this.db('flow_connections')
        .where({ id: connectionId })
        .update(connection)
        .returning('*');

      return updatedConnection;
    } catch (error) {
      logError('Error updating flow connection', error);
      throw error;
    }
  }

  async deleteConnection(connectionId: number): Promise<void> {
    try {
      await this.db('flow_connections')
        .where({ id: connectionId })
        .delete();
    } catch (error) {
      logError('Error deleting flow connection', error);
      throw error;
    }
  }

  async getNodeConnections(nodeId: number): Promise<FlowConnection[]> {
    try {
      return await this.db('flow_connections')
        .where({ source_node_id: nodeId })
        .orWhere({ target_node_id: nodeId })
        .orderBy('created_at');
    } catch (error) {
      logError('Error getting node connections', error);
      throw error;
    }
  }

  async getFlowStructure(flowId: number): Promise<{nodes: FlowNode[], connections: FlowConnection[]}> {
    try {
      const nodes = await this.db('flow_nodes')
        .where({ flow_id: flowId })
        .orderBy('created_at');

      const connections = await this.db('flow_connections')
        .where({ flow_id: flowId })
        .orderBy('created_at');

      return { nodes, connections };
    } catch (error) {
      logError('Error getting flow structure', error);
      throw error;
    }
  }

  async validateFlow(flowId: number): Promise<boolean> {
    try {
      const { nodes, connections } = await this.getFlowStructure(flowId);

      // Validate start node
      const startNode = nodes.find(node => node.type === 'start');
      if (!startNode) {
        throw new Error('Flow must have a start node');
      }

      // Validate end node
      const endNode = nodes.find(node => node.type === 'end');
      if (!endNode) {
        throw new Error('Flow must have an end node');
      }

      // Validate connections
      const nodeIds = new Set(nodes.map(node => node.id));
      for (const connection of connections) {
        if (!nodeIds.has(connection.source_node_id) || !nodeIds.has(connection.target_node_id)) {
          throw new Error('Invalid connection: node not found');
        }
      }

      // Validate path from start to end
      const visited = new Set<number>();
      const stack = [startNode.id];

      while (stack.length > 0) {
        const currentNodeId = stack.pop()!;
        visited.add(currentNodeId);

        const outgoingConnections = connections.filter(conn => conn.source_node_id === currentNodeId);
        for (const conn of outgoingConnections) {
          if (!visited.has(conn.target_node_id)) {
            stack.push(conn.target_node_id);
          }
        }
      }

      // Check if end node is reachable
      if (!visited.has(endNode.id)) {
        throw new Error('End node is not reachable from start node');
      }

      return true;
    } catch (error) {
      logError('Error validating flow', error);
      throw error;
    }
  }
}

export const flowManager = new FlowManager();
export default flowManager; 