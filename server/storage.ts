import { 
  users, 
  instances, 
  messageFlows, 
  activities,
  messageHistory,
  type User, 
  type InsertUser, 
  type Instance, 
  type InsertInstance,
  type MessageFlow,
  type InsertMessageFlow,
  type Activity,
  type InsertActivity,
  type MessageHistory,
  type InsertMessageHistory
} from "@shared/schema";
import session from "express-session";
import { v4 as uuidv4 } from "uuid";
import createMemoryStore from "memorystore";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import pg from "pg";
const { Pool } = pg;

// Configurações para o armazenamento de sessão
const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Instance methods
  getInstance(id: string): Promise<Instance | undefined>;
  getInstancesByUserId(userId: number): Promise<Instance[]>;
  getInstancesByName(name: string): Promise<Instance[]>;
  getAllConnectedInstances(): Promise<Instance[]>;
  createInstance(userId: number, instance: InsertInstance): Promise<Instance>;
  updateInstanceStatus(id: string, status: "connected" | "disconnected" | "connecting"): Promise<Instance | undefined>;
  updateInstanceLastConnection(id: string): Promise<Instance | undefined>;
  deleteInstance(id: string): Promise<boolean>;
  getInstanceIdByName(name: string): Promise<string | undefined>;
  
  // Message flow methods
  getMessageFlow(id: string): Promise<MessageFlow | undefined>;
  getMessageFlowsByUserId(userId: number): Promise<MessageFlow[]>;
  getMessageFlowsByInstanceId(instanceId: string): Promise<MessageFlow[]>;
  getMessageFlowByKeyword(instanceId: string, keyword: string): Promise<MessageFlow | undefined>;
  createMessageFlow(userId: number, flow: InsertMessageFlow): Promise<MessageFlow>;
  updateMessageFlow(id: string, flow: Partial<InsertMessageFlow>): Promise<MessageFlow | undefined>;
  updateMessageFlowStatus(id: string, status: string): Promise<MessageFlow | undefined>;
  deleteMessageFlow(id: string): Promise<boolean>;
  
  // Activity methods
  createActivity(userId: number, activity: InsertActivity): Promise<Activity>;
  getActivitiesByUserId(userId: number, limit?: number): Promise<Activity[]>;
  
  // Message history methods
  createMessageHistory(userId: number, messageData: InsertMessageHistory): Promise<MessageHistory>;
  updateMessageHistoryStatus(messageHistoryId: number, newStatus: string, notes?: string): Promise<MessageHistory | undefined>;
  getMessageHistoryByUserId(userId: number, limit?: number): Promise<MessageHistory[]>;
  getMessageHistoryByInstanceId(instanceId: string, limit?: number): Promise<MessageHistory[]>;
  getRecentMessageHistory(limit?: number, params?: {instanceId?: string}): Promise<MessageHistory[]>;
  getLatestMessageHistory(limit?: number): Promise<MessageHistory[]>;
  
  // Logging and debug methods
  getRecentActivities(limit?: number): Promise<Activity[]>;
  getSystemLogsByType(type: string, limit?: number): Promise<any[]>;
  getInstanceLogs(instanceName: string, limit?: number): Promise<any[]>;
  
  sessionStore: any; // Type for session store
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private instances: Map<string, Instance>;
  private messageFlows: Map<string, MessageFlow>;
  private activities: Map<number, Activity>;
  private userId: number;
  private activityId: number;
  sessionStore: any;

  constructor() {
    this.users = new Map();
    this.instances = new Map();
    this.messageFlows = new Map();
    this.activities = new Map();
    this.userId = 1;
    this.activityId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Instance methods
  async getInstance(id: string): Promise<Instance | undefined> {
    return this.instances.get(id);
  }

  async getInstancesByUserId(userId: number): Promise<Instance[]> {
    return Array.from(this.instances.values()).filter(
      (instance) => instance.userId === userId,
    );
  }
  
  async getInstancesByName(name: string): Promise<Instance[]> {
    return Array.from(this.instances.values()).filter(
      (instance) => instance.name === name,
    );
  }
  
  async getAllConnectedInstances(): Promise<Instance[]> {
    return Array.from(this.instances.values()).filter(
      (instance) => instance.status === "connected",
    );
  }

  async createInstance(userId: number, insertInstance: InsertInstance): Promise<Instance> {
    const id = uuidv4();
    const now = new Date();
    const instance: Instance = { 
      ...insertInstance, 
      id, 
      userId, 
      status: "disconnected", 
      lastConnection: null
    };
    this.instances.set(id, instance);
    
    // Create activity
    await this.createActivity(userId, {
      type: "instance_created",
      description: `Instance ${insertInstance.name} created`,
      entityId: id,
      entityType: "instance",
    });
    
    return instance;
  }

  async updateInstanceStatus(id: string, status: "connected" | "disconnected" | "connecting"): Promise<Instance | undefined> {
    const instance = this.instances.get(id);
    if (!instance) return undefined;
    
    const updatedInstance = { ...instance, status };
    this.instances.set(id, updatedInstance);
    
    // Create activity
    await this.createActivity(instance.userId, {
      type: `instance_${status}`,
      description: `Instance ${instance.name} ${status}`,
      entityId: id,
      entityType: "instance",
    });
    
    return updatedInstance;
  }

  async updateInstanceLastConnection(id: string): Promise<Instance | undefined> {
    const instance = this.instances.get(id);
    if (!instance) return undefined;
    
    const lastConnection = new Date();
    const updatedInstance = { ...instance, lastConnection };
    this.instances.set(id, updatedInstance);
    
    return updatedInstance;
  }

  async deleteInstance(id: string): Promise<boolean> {
    const instance = this.instances.get(id);
    if (!instance) return false;
    
    // Delete all message flows for this instance
    const flows = await this.getMessageFlowsByInstanceId(id);
    for (const flow of flows) {
      await this.deleteMessageFlow(flow.id);
    }
    
    const result = this.instances.delete(id);
    
    // Create activity
    await this.createActivity(instance.userId, {
      type: "instance_deleted",
      description: `Instance ${instance.name} deleted`,
      entityId: id,
      entityType: "instance",
    });
    
    return result;
  }

  // Message flow methods
  async getMessageFlow(id: string): Promise<MessageFlow | undefined> {
    return this.messageFlows.get(id);
  }

  async getMessageFlowsByUserId(userId: number): Promise<MessageFlow[]> {
    return Array.from(this.messageFlows.values()).filter(
      (flow) => flow.userId === userId,
    );
  }

  async getMessageFlowsByInstanceId(instanceId: string): Promise<MessageFlow[]> {
    const flows = Array.from(this.messageFlows.values()).filter(
      (flow) => flow.instanceId === instanceId,
    );
    return flows;
  }

  async getMessageFlowByKeyword(instanceId: string, keyword: string): Promise<MessageFlow | undefined> {
    return Array.from(this.messageFlows.values()).find(
      (flow) => flow.instanceId === instanceId && flow.keyword.toLowerCase() === keyword.toLowerCase(),
    );
  }

  async createMessageFlow(userId: number, insertFlow: InsertMessageFlow): Promise<MessageFlow> {
    const id = uuidv4();
    const flow: MessageFlow = { 
      ...insertFlow, 
      id, 
      userId, 
      status: insertFlow.status || "active",
      triggerKeyword: insertFlow.triggerKeyword || "",
      triggerType: insertFlow.triggerType || "exact_match",
      activationDelay: insertFlow.activationDelay || 0
    };
    this.messageFlows.set(id, flow);
    
    // Create activity
    await this.createActivity(userId, {
      type: "flow_created",
      description: `Fluxo de mensagens "${insertFlow.name}" criado`,
      entityId: id,
      entityType: "message_flow",
    });
    
    return flow;
  }

  async updateMessageFlow(id: string, updateFlow: Partial<InsertMessageFlow>): Promise<MessageFlow | undefined> {
    const flow = this.messageFlows.get(id);
    if (!flow) return undefined;
    
    const updatedFlow = { ...flow, ...updateFlow };
    this.messageFlows.set(id, updatedFlow);
    
    // Create activity
    await this.createActivity(flow.userId, {
      type: "flow_updated",
      description: `Message flow ${flow.name} updated`,
      entityId: id,
      entityType: "message_flow",
    });
    
    return updatedFlow;
  }
  
  async updateMessageFlowStatus(id: string, status: string): Promise<MessageFlow | undefined> {
    const flow = this.messageFlows.get(id);
    if (!flow) return undefined;
    
    const updatedFlow = { ...flow, status };
    this.messageFlows.set(id, updatedFlow);
    
    // Create activity
    await this.createActivity(flow.userId, {
      type: `flow_${status}`,
      description: `Message flow ${flow.name} ${status}`,
      entityId: id,
      entityType: "message_flow",
    });
    
    return updatedFlow;
  }

  async deleteMessageFlow(id: string): Promise<boolean> {
    const flow = this.messageFlows.get(id);
    if (!flow) return false;
    
    const result = this.messageFlows.delete(id);
    
    // Create activity
    await this.createActivity(flow.userId, {
      type: "flow_deleted",
      description: `Message flow ${flow.name} deleted`,
      entityId: id,
      entityType: "message_flow",
    });
    
    return result;
  }

  // Activity methods
  async createActivity(userId: number, insertActivity: InsertActivity): Promise<Activity> {
    const id = this.activityId++;
    const createdAt = new Date();
    const timestamp = insertActivity.timestamp || new Date();
    const activity: Activity = { 
      ...insertActivity, 
      id, 
      userId, 
      createdAt,
      timestamp,
      status: insertActivity.status || null,
      instanceId: insertActivity.instanceId || null,
      flowId: insertActivity.flowId || null,
      entityId: insertActivity.entityId || null,
      entityType: insertActivity.entityType || null
    };
    this.activities.set(id, activity);
    return activity;
  }

  async getActivitiesByUserId(userId: number, limit: number = 10): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .filter(activity => activity.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  // Message history methods
  private messageHistories: Map<string, MessageHistory> = new Map();
  private messageHistoryId: number = 1;
  
  async createMessageHistory(userId: number, insertMessageHistory: InsertMessageHistory): Promise<MessageHistory> {
    const id = this.messageHistoryId++;
    // Usar o timestamp fornecido ou criar um novo timestamp
    const timestamp = insertMessageHistory.timestamp || new Date();
    const messageHistory: MessageHistory = {
      ...insertMessageHistory,
      id,
      userId,
      timestamp,
      status: insertMessageHistory.status || "no_match",
      flowId: insertMessageHistory.flowId || null,
      triggeredKeyword: insertMessageHistory.triggeredKeyword || null
    };
    this.messageHistories.set(id.toString(), messageHistory);
    return messageHistory;
  }
  
  async getMessageHistoryByUserId(userId: number, limit: number = 100): Promise<MessageHistory[]> {
    return Array.from(this.messageHistories.values())
      .filter(history => history.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  async getMessageHistoryByInstanceId(instanceId: string, limit: number = 100): Promise<MessageHistory[]> {
    return Array.from(this.messageHistories.values())
      .filter(history => history.instanceId === instanceId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  async getRecentMessageHistory(limit: number = 100, params?: {instanceId?: string}): Promise<MessageHistory[]> {
    let filtered = Array.from(this.messageHistories.values());
    
    // Se tiver filtro por instanceId, aplicar
    if (params?.instanceId) {
      filtered = filtered.filter(history => history.instanceId === params.instanceId);
    }
    
    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  async updateMessageHistoryStatus(messageHistoryId: number, newStatus: string, notes?: string): Promise<MessageHistory | undefined> {
    try {
      const messageHistory = this.messageHistories.get(messageHistoryId.toString());
      if (!messageHistory) return undefined;
      
      // Atualiza o status e adiciona notas no messageContent se fornecido
      const updatedMessageHistory = { 
        ...messageHistory, 
        status: newStatus 
      };
      
      // Se tiver notas, adiciona ao conteúdo da mensagem
      if (notes) {
        updatedMessageHistory.messageContent = `${updatedMessageHistory.messageContent} [Nota: ${notes}]`;
      }
      
      this.messageHistories.set(messageHistoryId.toString(), updatedMessageHistory);
      return updatedMessageHistory;
    } catch (error) {
      console.error("Error updating message history status:", error);
      return undefined;
    }
  }
  
  async getLatestMessageHistory(limit: number = 30): Promise<MessageHistory[]> {
    // Retornar todas as mensagens ordenadas por timestamp, independente da instância ou usuário
    return Array.from(this.messageHistories.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  // Implementação dos novos métodos adicionados para logs do sistema
  async getSystemLogsByType(type: string, limit: number = 20): Promise<any[]> {
    // Simular logs do sistema com dados sintéticos (apenas para MemStorage)
    const logs = [];
    
    // Gerar logs do tipo especificado
    if (type === 'webhook') {
      logs.push({
        timestamp: new Date(),
        message: `Webhook processado para instância teste1: mensagem recebida`,
        type: 'webhook'
      });
      logs.push({
        timestamp: new Date(Date.now() - 60000),
        message: `Webhook configurado para instância teste1: sucesso`,
        type: 'webhook'
      });
    }
    
    return logs.slice(0, limit);
  }
  
  async getInstanceLogs(instanceName: string, limit: number = 20): Promise<any[]> {
    // Simular logs de instância (apenas para MemStorage)
    const logs = [];
    
    if (instanceName.toLowerCase() === 'teste1') {
      // Pegar mensagens relacionadas à instância teste1
      const teste1Instances = Array.from(this.instances.values())
        .filter(instance => instance.name.toLowerCase() === 'teste1');
        
      if (teste1Instances.length > 0) {
        const teste1Id = teste1Instances[0].id;
        
        // Adicionar logs baseados em mensagens existentes
        const instanceMsgs = Array.from(this.messageHistories.values())
          .filter(msg => msg.instanceId === teste1Id)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, limit);
          
        instanceMsgs.forEach(msg => {
          logs.push({
            timestamp: msg.timestamp,
            message: `Mensagem processada: ${msg.messageContent} de ${msg.sender}`,
            type: 'message',
            status: msg.status
          });
        });
      }
    }
    
    return logs.slice(0, limit);
  }
  
  async getInstanceIdByName(name: string): Promise<string | undefined> {
    const foundInstances = Array.from(this.instances.values())
      .filter(instance => instance.name.toLowerCase() === name.toLowerCase());
      
    return foundInstances.length > 0 ? foundInstances[0].id : undefined;
  }
  
  async getRecentActivities(limit: number = 100): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
    
    // Criar usuário de demonstração se não existir
    this.ensureDefaultUser();
  }

  private async ensureDefaultUser() {
    try {
      const existingUser = await this.getUserByUsername("demo");
      if (!existingUser) {
        await this.createUser({
          username: "demo",
          password: "demo",
          name: "Demo User",
          email: "demo@example.com"
        });
        console.log("Default user 'demo' created");
      }
    } catch (error) {
      console.error("Error ensuring default user:", error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getInstance(id: string): Promise<Instance | undefined> {
    try {
      const [instance] = await db.select().from(instances).where(eq(instances.id, id));
      return instance;
    } catch (error) {
      console.error("Error getting instance:", error);
      return undefined;
    }
  }

  async getInstancesByUserId(userId: number): Promise<Instance[]> {
    try {
      return await db.select().from(instances).where(eq(instances.userId, userId));
    } catch (error) {
      console.error("Error getting instances by user ID:", error);
      return [];
    }
  }

  async getInstancesByName(name: string): Promise<Instance[]> {
    try {
      return await db.select().from(instances).where(eq(instances.name, name));
    } catch (error) {
      console.error("Error getting instances by name:", error);
      return [];
    }
  }
  
  async getAllConnectedInstances(): Promise<Instance[]> {
    try {
      return await db.select().from(instances).where(eq(instances.status, "connected"));
    } catch (error) {
      console.error("Error getting connected instances:", error);
      return [];
    }
  }

  async createInstance(userId: number, insertInstance: InsertInstance): Promise<Instance> {
    const id = uuidv4();
    
    const [instance] = await db
      .insert(instances)
      .values({
        ...insertInstance,
        id,
        userId,
        status: "disconnected"
      })
      .returning();

    // Criar atividade
    await this.createActivity(userId, {
      type: "instance_created",
      description: `Instância "${insertInstance.name}" criada`,
      entityId: id,
      entityType: "instance"
    });
    
    return instance;
  }

  async updateInstanceStatus(id: string, status: "connected" | "disconnected" | "connecting"): Promise<Instance | undefined> {
    try {
      const [instance] = await db
        .update(instances)
        .set({ status })
        .where(eq(instances.id, id))
        .returning();
      
      if (instance) {
        // Criar atividade
        let statusDesc = "desconectada";
        if (status === "connected") statusDesc = "conectada";
        else if (status === "connecting") statusDesc = "conectando";
        
        await this.createActivity(instance.userId, {
          type: `instance_${status}`,
          description: `Instância "${instance.name}" ${statusDesc}`,
          entityId: id,
          entityType: "instance"
        });
      }
      
      return instance;
    } catch (error) {
      console.error("Error updating instance status:", error);
      return undefined;
    }
  }

  async updateInstanceLastConnection(id: string): Promise<Instance | undefined> {
    try {
      const [instance] = await db
        .update(instances)
        .set({ lastConnection: new Date() })
        .where(eq(instances.id, id))
        .returning();
      return instance;
    } catch (error) {
      console.error("Error updating instance last connection:", error);
      return undefined;
    }
  }

  async deleteInstance(id: string): Promise<boolean> {
    try {
      // Obter a instância antes de excluir para registrar a atividade
      const instance = await this.getInstance(id);
      if (!instance) return false;
      
      // Excluir fluxos de mensagem associados
      const flows = await this.getMessageFlowsByInstanceId(id);
      for (const flow of flows) {
        await this.deleteMessageFlow(flow.id);
      }
      
      // Excluir instância
      const result = await db
        .delete(instances)
        .where(eq(instances.id, id))
        .returning();
        
      // Criar atividade
      if (result.length > 0) {
        await this.createActivity(instance.userId, {
          type: "instance_deleted",
          description: `Instância "${instance.name}" deletada`,
          entityId: id,
          entityType: "instance"
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error deleting instance:", error);
      return false;
    }
  }

  async getMessageFlow(id: string): Promise<MessageFlow | undefined> {
    try {
      const [flow] = await db.select().from(messageFlows).where(eq(messageFlows.id, id));
      return flow;
    } catch (error) {
      console.error("Error getting message flow:", error);
      return undefined;
    }
  }

  async getMessageFlowsByUserId(userId: number): Promise<MessageFlow[]> {
    try {
      return await db.select().from(messageFlows).where(eq(messageFlows.userId, userId));
    } catch (error) {
      console.error("Error getting message flows by user ID:", error);
      return [];
    }
  }

  async getMessageFlowsByInstanceId(instanceId: string): Promise<MessageFlow[]> {
    try {
      return await db.select().from(messageFlows).where(eq(messageFlows.instanceId, instanceId));
    } catch (error) {
      console.error("Error getting message flows by instance ID:", error);
      return [];
    }
  }

  async getMessageFlowByKeyword(instanceId: string, keyword: string): Promise<MessageFlow | undefined> {
    try {
      const [flow] = await db
        .select()
        .from(messageFlows)
        .where(
          and(
            eq(messageFlows.instanceId, instanceId),
            eq(messageFlows.keyword, keyword.toLowerCase())
          )
        );
      return flow;
    } catch (error) {
      console.error("Error getting message flow by keyword:", error);
      return undefined;
    }
  }

  async createMessageFlow(userId: number, insertFlow: InsertMessageFlow): Promise<MessageFlow> {
    const id = uuidv4();
    
    const [flow] = await db
      .insert(messageFlows)
      .values({
        ...insertFlow,
        id,
        userId,
        status: insertFlow.status || "active",
        triggerKeyword: insertFlow.triggerKeyword || "",
        triggerType: insertFlow.triggerType || "exact_match",
        activationDelay: insertFlow.activationDelay || 0
      })
      .returning();
    
    // Criar atividade
    await this.createActivity(userId, {
      type: "flow_created",
      description: `Fluxo de mensagens "${insertFlow.name}" criado`,
      entityId: id,
      entityType: "message_flow"
    });
    
    return flow;
  }

  async updateMessageFlow(id: string, updateFlow: Partial<InsertMessageFlow>): Promise<MessageFlow | undefined> {
    try {
      const [flow] = await db
        .update(messageFlows)
        .set(updateFlow)
        .where(eq(messageFlows.id, id))
        .returning();
      
      if (flow) {
        // Criar atividade
        await this.createActivity(flow.userId, {
          type: "flow_updated",
          description: `Fluxo de mensagens "${flow.name}" atualizado`,
          entityId: id,
          entityType: "message_flow"
        });
      }
      
      return flow;
    } catch (error) {
      console.error("Error updating message flow:", error);
      return undefined;
    }
  }

  async updateMessageFlowStatus(id: string, status: string): Promise<MessageFlow | undefined> {
    try {
      const [flow] = await db
        .update(messageFlows)
        .set({ status })
        .where(eq(messageFlows.id, id))
        .returning();
      
      if (flow) {
        // Criar atividade
        await this.createActivity(flow.userId, {
          type: `flow_${status}`,
          description: `Fluxo de mensagens "${flow.name}" ${status === "active" ? "ativado" : "desativado"}`,
          entityId: id,
          entityType: "message_flow"
        });
      }
      
      return flow;
    } catch (error) {
      console.error("Error updating message flow status:", error);
      return undefined;
    }
  }

  async deleteMessageFlow(id: string): Promise<boolean> {
    try {
      // Obter o fluxo antes de excluir para registrar a atividade
      const flow = await this.getMessageFlow(id);
      if (!flow) return false;
      
      const result = await db
        .delete(messageFlows)
        .where(eq(messageFlows.id, id))
        .returning();
        
      // Criar atividade
      if (result.length > 0) {
        await this.createActivity(flow.userId, {
          type: "flow_deleted",
          description: `Fluxo de mensagens "${flow.name}" deletado`,
          entityId: id,
          entityType: "message_flow"
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error deleting message flow:", error);
      return false;
    }
  }

  async createActivity(userId: number, insertActivity: InsertActivity): Promise<Activity> {
    try {
      const [activity] = await db
        .insert(activities)
        .values({
          ...insertActivity,
          userId
        })
        .returning();
      return activity;
    } catch (error) {
      console.error("Error creating activity:", error);
      throw error;
    }
  }

  async getActivitiesByUserId(userId: number, limit: number = 10): Promise<Activity[]> {
    try {
      return await db
        .select()
        .from(activities)
        .where(eq(activities.userId, userId))
        .orderBy(desc(activities.createdAt))
        .limit(limit);
    } catch (error) {
      console.error("Error getting activities by user ID:", error);
      return [];
    }
  }
  
  // Message history methods
  async createMessageHistory(userId: number, insertMessageHistory: InsertMessageHistory): Promise<MessageHistory> {
    try {
      const [messageHistoryRecord] = await db
        .insert(messageHistory)
        .values({
          ...insertMessageHistory,
          userId
        })
        .returning();
      return messageHistoryRecord;
    } catch (error) {
      console.error("Error creating message history:", error);
      throw error;
    }
  }
  
  async getMessageHistoryByUserId(userId: number, limit: number = 100): Promise<MessageHistory[]> {
    try {
      return await db
        .select()
        .from(messageHistory)
        .where(eq(messageHistory.userId, userId))
        .orderBy(desc(messageHistory.timestamp))
        .limit(limit);
    } catch (error) {
      console.error("Error getting message history by user ID:", error);
      return [];
    }
  }
  
  async getMessageHistoryByInstanceId(instanceId: string, limit: number = 100): Promise<MessageHistory[]> {
    try {
      return await db
        .select()
        .from(messageHistory)
        .where(eq(messageHistory.instanceId, instanceId))
        .orderBy(desc(messageHistory.timestamp))
        .limit(limit);
    } catch (error) {
      console.error("Error getting message history by instance ID:", error);
      return [];
    }
  }
  
  // Método para obter mensagens recentes, independente do usuário ou instância
  async updateMessageHistoryStatus(messageHistoryId: number, newStatus: string, notes?: string): Promise<MessageHistory | undefined> {
    try {
      // Busca o registro de histórico para verificar se existe
      const [existingRecord] = await db
        .select()
        .from(messageHistory)
        .where(eq(messageHistory.id, messageHistoryId));
        
      if (!existingRecord) {
        return undefined;
      }
      
      // Prepara o objeto de atualização
      const updateData: any = { status: newStatus };
      
      // Se tiver notas, adiciona ao conteúdo da mensagem
      if (notes) {
        updateData.messageContent = `${existingRecord.messageContent} [Nota: ${notes}]`;
      }
      
      // Executa a atualização
      const [updatedRecord] = await db
        .update(messageHistory)
        .set(updateData)
        .where(eq(messageHistory.id, messageHistoryId))
        .returning();
        
      return updatedRecord;
    } catch (error) {
      console.error("Error updating message history status:", error);
      return undefined;
    }
  }
  
  async getRecentMessageHistory(limit: number = 100, params?: {instanceId?: string}): Promise<MessageHistory[]> {
    try {
      let query = db.select().from(messageHistory);
      
      // Aplicar filtro por instanceId se fornecido
      if (params?.instanceId) {
        query = query.where(eq(messageHistory.instanceId, params.instanceId));
      }
      
      return await query.orderBy(desc(messageHistory.timestamp)).limit(limit);
    } catch (error) {
      console.error("Error getting recent message history:", error);
      return [];
    }
  }
  
  async getLatestMessageHistory(limit: number = 30): Promise<MessageHistory[]> {
    try {
      // Buscar todas as mensagens mais recentes, independente da instância ou usuário
      return await db
        .select()
        .from(messageHistory)
        .orderBy(desc(messageHistory.timestamp))
        .limit(limit);
    } catch (error) {
      console.error("Error getting latest message history:", error);
      return [];
    }
  }
  
  // Implementação dos novos métodos de sistema de logs
  async getSystemLogsByType(type: string, limit: number = 20): Promise<any[]> {
    try {
      // Temporário: Utilizando histórico de mensagens para simular logs do sistema
      // Em produção, seria melhor ter uma tabela separada para logs do sistema
      const logs: any[] = [];
      
      // Se tipoé webhook, buscar mensagens recebidas por webhook
      if (type === 'webhook') {
        const webhookMessages = await db
          .select()
          .from(messageHistory)
          .where(eq(messageHistory.status, 'received'))
          .orderBy(desc(messageHistory.timestamp))
          .limit(limit);
          
        webhookMessages.forEach(msg => {
          logs.push({
            timestamp: msg.timestamp,
            message: `Mensagem recebida via webhook para instância ${msg.instanceName || 'desconhecida'}: "${msg.messageContent}" de ${msg.sender}`,
            type: 'webhook'
          });
        });
      }
      
      return logs;
    } catch (error) {
      console.error(`Error getting system logs by type ${type}:`, error);
      return [];
    }
  }
  
  async getInstanceLogs(instanceName: string, limit: number = 20): Promise<any[]> {
    try {
      // Buscar instâncias pelo nome
      const instanceList = await this.getInstancesByName(instanceName);
      if (!instanceList.length) return [];
      
      const instanceId = instanceList[0].id;
      
      // Buscar mensagens relacionadas à instância
      const instanceMessages = await db
        .select()
        .from(messageHistory)
        .where(eq(messageHistory.instanceId, instanceId))
        .orderBy(desc(messageHistory.timestamp))
        .limit(limit);
        
      return instanceMessages.map(msg => ({
        timestamp: msg.timestamp,
        message: `${msg.status === 'received' ? 'Recebida via webhook' : 'Processada'}: "${msg.messageContent}" de ${msg.sender}`,
        type: 'message',
        status: msg.status
      }));
    } catch (error) {
      console.error(`Error getting logs for instance ${instanceName}:`, error);
      return [];
    }
  }
  
  async getInstanceIdByName(name: string): Promise<string | undefined> {
    try {
      const instances = await this.getInstancesByName(name);
      return instances.length > 0 ? instances[0].id : undefined;
    } catch (error) {
      console.error(`Error getting instance ID by name ${name}:`, error);
      return undefined;
    }
  }
  
  // Método para obter atividades recentes
  async getRecentActivities(limit: number = 100): Promise<Activity[]> {
    try {
      return await db
        .select()
        .from(activities)
        .orderBy(desc(activities.createdAt))
        .limit(limit);
    } catch (error) {
      console.error("Error getting recent activities:", error);
      return [];
    }
  }
}

// Trocar implementação para usar o banco de dados PostgreSQL
export const storage = new DatabaseStorage();
