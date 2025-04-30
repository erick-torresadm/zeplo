import { whatsAppService } from './whatsapp';
import { flowManager } from './flow-manager';
import { logError, logInfo } from '../utils/logger';
import { mediaService } from './media';

interface ExecutionContext {
  flowId: number;
  instanceId: number;
  phoneNumber: string;
  variables: Record<string, any>;
  currentNodeId: number | null;
}

export class FlowExecutor {
  private async executeNode(context: ExecutionContext, node: any): Promise<number | null> {
    try {
      switch (node.type) {
        case 'start':
          // Start node just passes through
          return this.getNextNode(context.flowId, node.id);

        case 'message':
          await this.executeMessageNode(context, node);
          return this.getNextNode(context.flowId, node.id);

        case 'condition':
          return this.executeConditionNode(context, node);

        case 'action':
          await this.executeActionNode(context, node);
          return this.getNextNode(context.flowId, node.id);

        case 'end':
          return null;

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    } catch (error) {
      logError(`Error executing node ${node.id}`, error);
      throw error;
    }
  }

  private async executeMessageNode(context: ExecutionContext, node: any): Promise<void> {
    const { data } = node;
    const { message, mediaUrl, mediaType } = data;

    // Replace variables in message
    const processedMessage = this.replaceVariables(message, context.variables);

    if (mediaUrl) {
      // Get signed URL for media if needed
      const signedUrl = await mediaService.getSignedUrl(mediaUrl);
      
      await whatsAppService.sendMediaMessage(
        context.instanceId,
        context.phoneNumber,
        signedUrl,
        processedMessage,
        mediaType
      );
    } else {
      await whatsAppService.sendMessage(
        context.instanceId,
        context.phoneNumber,
        processedMessage
      );
    }

    // Apply delay if specified
    const delay = data.delay || 0;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }
  }

  private async executeConditionNode(context: ExecutionContext, node: any): Promise<number | null> {
    const { data } = node;
    const { condition } = data;

    // Get connections for this node
    const connections = await flowManager.getNodeConnections(node.id);
    
    // Evaluate condition
    const result = this.evaluateCondition(condition, context.variables);

    // Find matching connection
    const matchingConnection = connections.find(conn => 
      (result && conn.condition === 'true') || 
      (!result && conn.condition === 'false')
    );

    return matchingConnection ? matchingConnection.target_node_id : null;
  }

  private async executeActionNode(context: ExecutionContext, node: any): Promise<void> {
    const { data } = node;
    const { action, params } = data;

    // Process action parameters
    const processedParams = Object.entries(params).reduce((acc, [key, value]) => ({
      ...acc,
      [key]: this.replaceVariables(value as string, context.variables)
    }), {});

    // Execute action
    switch (action) {
      case 'set_variable':
        if (
          typeof processedParams === 'object' && 
          processedParams !== null && 
          'name' in processedParams && 
          'value' in processedParams
        ) {
          context.variables[processedParams.name as string] = processedParams.value;
        } else {
          logError('Missing required parameters for set_variable action', { params: processedParams });
        }
        break;

      case 'webhook':
        // Implementation for webhook calls
        break;

      default:
        throw new Error(`Unknown action type: ${action}`);
    }
  }

  private async getNextNode(flowId: number, currentNodeId: number): Promise<number | null> {
    const connections = await flowManager.getNodeConnections(currentNodeId);
    return connections[0]?.target_node_id || null;
  }

  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(.*?)\}\}/g, (match, variable) => {
      const trimmedVar = variable.trim();
      return variables[trimmedVar] !== undefined ? variables[trimmedVar] : match;
    });
  }

  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    try {
      // Replace variables in condition
      const processedCondition = this.replaceVariables(condition, variables);
      
      // Safely evaluate condition
      // Note: In a production environment, you should use a proper expression evaluator
      return new Function(`return ${processedCondition}`)();
    } catch (error) {
      logError('Error evaluating condition', error);
      return false;
    }
  }

  async executeFlow(flowId: number, instanceId: number, phoneNumber: string, initialVariables: Record<string, any> = {}): Promise<void> {
    try {
      // Get flow structure
      const { nodes, connections } = await flowManager.getFlowStructure(flowId);
      
      // Find start node
      const startNode = nodes.find(node => node.type === 'start');
      if (!startNode) {
        throw new Error('Flow must have a start node');
      }

      // Initialize execution context
      const context: ExecutionContext = {
        flowId,
        instanceId,
        phoneNumber,
        variables: initialVariables,
        currentNodeId: startNode.id
      };

      // Execute nodes until we reach an end node or error
      let currentNodeId = startNode.id;
      while (currentNodeId) {
        const currentNode = nodes.find(node => node.id === currentNodeId);
        if (!currentNode) {
          throw new Error(`Node ${currentNodeId} not found`);
        }

        // Update current node in context
        context.currentNodeId = currentNodeId;

        // Execute node and get next node
        currentNodeId = await this.executeNode(context, currentNode);
      }

      logInfo('Flow execution completed', {
        flowId,
        instanceId,
        phoneNumber
      });
    } catch (error) {
      logError('Error executing flow', error);
      throw error;
    }
  }
}

export const flowExecutor = new FlowExecutor();
export default flowExecutor; 