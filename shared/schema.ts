import { pgTable, text, serial, integer, boolean, uuid, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Interface para contatos do WhatsApp
export interface WhatsAppContact {
  phoneNumber: string;
  name?: string;
  pushName?: string;
}

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
});

export const instances = pgTable("instances", {
  id: text("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  status: text("status", { enum: ["connected", "disconnected", "connecting"] }).notNull().default("disconnected"),
  lastConnection: timestamp("last_connection"),
});

export const messageFlows = pgTable("message_flows", {
  id: text("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  instanceId: text("instance_id").references(() => instances.id).notNull(),
  name: text("name").notNull(),
  keyword: text("keyword").notNull(),
  triggerKeyword: text("trigger_keyword").notNull().default(""),
  messages: jsonb("messages").$type<Message[]>().notNull(),
  status: text("status").notNull().default("inactive"),
  // Novos campos para suportar diferentes tipos de gatilho e tempo de atraso
  triggerType: text("trigger_type", { enum: ["exact_match", "contains", "all_messages"] }).notNull().default("exact_match"),
  activationDelay: integer("activation_delay").notNull().default(0),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  entityId: text("entity_id"),
  entityType: text("entity_type"),
  instanceId: text("instance_id").references(() => instances.id),
  flowId: text("flow_id").references(() => messageFlows.id),
  status: text("status"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messageHistory = pgTable("message_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  instanceId: text("instance_id").references(() => instances.id).notNull(),
  instanceName: text("instance_name").notNull(),
  sender: text("sender").notNull(),
  messageContent: text("message_content").notNull(),
  triggeredKeyword: text("triggered_keyword"),
  flowId: text("flow_id").references(() => messageFlows.id),
  status: text("status", { enum: ["triggered", "no_match", "error", "scheduled", "received"] }).notNull().default("no_match"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Tabela de contatos do WhatsApp
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  instanceId: text("instance_id").references(() => instances.id).notNull(),
  phoneNumber: text("phone_number").notNull(),
  name: text("name"),
  pushName: text("push_name"),
  lastSeen: timestamp("last_seen").defaultNow(),
  isBusinessContact: boolean("is_business").default(false),
  metadata: jsonb("metadata"), // Dados adicionais do contato
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tabela de tags para categorizar contatos
export const contactTags = pgTable("contact_tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"), // Cor da tag (padrão: indigo)
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tabela de relacionamento entre contatos e tags (many-to-many)
export const contactsToTags = pgTable("contacts_to_tags", {
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  tagId: integer("tag_id").references(() => contactTags.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.contactId, table.tagId] }),
  };
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  avatarUrl: true,
});

export const insertInstanceSchema = createInsertSchema(instances).pick({
  name: true,
});

// Define os tipos de mensagem possíveis
export const messageTypeEnum = z.enum([
  "text",     // Mensagem de texto simples
  "image",    // Mensagem com imagem
  "audio",    // Mensagem com áudio
  "video",    // Mensagem com vídeo
  "document", // Mensagem com documento/arquivo
  "button"    // Mensagem com botões
]);

// Schema base para todas as mensagens
const baseMessageSchema = z.object({
  type: messageTypeEnum.default("text"),
  delay: z.number().min(0).default(1),
});

// Schema específico para mensagem de texto
const textMessageSchema = baseMessageSchema.extend({
  type: z.literal("text"),
  text: z.string().min(1, "O texto da mensagem não pode estar vazio"),
});

// Schema para mensagem com imagem
const imageMessageSchema = baseMessageSchema.extend({
  type: z.literal("image"),
  mediaUrl: z.string().min(1, "A URL da imagem não pode estar vazia"),
  caption: z.string().optional().default(""),
  fileName: z.string().optional(),
});

// Schema para mensagem com áudio
const audioMessageSchema = baseMessageSchema.extend({
  type: z.literal("audio"),
  mediaUrl: z.string().min(1, "A URL do áudio não pode estar vazia"),
  fileName: z.string().optional(),
  ptt: z.boolean().optional().default(false), // Indica se é uma mensagem de voz (Push To Talk)
});

// Schema para mensagem com vídeo
const videoMessageSchema = baseMessageSchema.extend({
  type: z.literal("video"),
  mediaUrl: z.string().min(1, "A URL do vídeo não pode estar vazia"),
  caption: z.string().optional().default(""),
  fileName: z.string().optional(),
});

// Schema para mensagem com documento
const documentMessageSchema = baseMessageSchema.extend({
  type: z.literal("document"),
  mediaUrl: z.string().min(1, "A URL do documento não pode estar vazia"),
  fileName: z.string().min(1, "O nome do arquivo é obrigatório"),
});

// Schema para mensagem com botões
const buttonMessageSchema = baseMessageSchema.extend({
  type: z.literal("button"),
  text: z.string().min(1, "O texto da mensagem não pode estar vazio"),
  buttons: z.array(z.object({
    id: z.string(),
    text: z.string().min(1, "O texto do botão não pode estar vazio"),
  })).min(1, "Deve haver pelo menos um botão").max(3, "Máximo de 3 botões permitidos"),
});

// Schema principal que discrimina os diferentes tipos de mensagem
export const messageSchema = z.discriminatedUnion("type", [
  textMessageSchema,
  imageMessageSchema,
  audioMessageSchema,
  videoMessageSchema,
  documentMessageSchema,
  buttonMessageSchema,
]);

export const messageFlowSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  keyword: z.string().min(2, "Palavra-chave deve ter pelo menos 2 caracteres"),
  triggerKeyword: z.string().optional(),
  instanceId: z.string().uuid("ID da instância deve ser um UUID válido"),
  messages: z.array(messageSchema).min(1, "Deve ter pelo menos uma mensagem"),
  status: z.string().optional(),
  triggerType: z.enum(["exact_match", "contains", "all_messages"]).optional().default("exact_match"),
  activationDelay: z.number().int().min(0).optional().default(0)
});

export const insertMessageFlowSchema = createInsertSchema(messageFlows).extend({
  messages: z.array(messageSchema),
}).pick({
  name: true,
  keyword: true,
  triggerKeyword: true,
  instanceId: true,
  messages: true,
  triggerType: true,
  activationDelay: true,
  status: true,
});

export const insertActivitySchema = createInsertSchema(activities).pick({
  type: true,
  description: true,
  entityId: true,
  entityType: true,
  instanceId: true,
  flowId: true,
  status: true,
  timestamp: true,
});

export const insertMessageHistorySchema = createInsertSchema(messageHistory).pick({
  instanceId: true,
  instanceName: true,
  sender: true,
  messageContent: true,
  triggeredKeyword: true,
  flowId: true,
  status: true,
  timestamp: true,
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  instanceId: true,
  phoneNumber: true,
  name: true,
  pushName: true,
  isBusinessContact: true,
  metadata: true,
});

export const insertContactTagSchema = createInsertSchema(contactTags).pick({
  name: true,
  color: true,
  description: true,
});

export const insertContactToTagSchema = createInsertSchema(contactsToTags).pick({
  contactId: true,
  tagId: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertInstance = z.infer<typeof insertInstanceSchema>;
export type Instance = typeof instances.$inferSelect;

export type Message = z.infer<typeof messageSchema>;
export type InsertMessageFlow = z.infer<typeof insertMessageFlowSchema>;
export type MessageFlow = typeof messageFlows.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type InsertMessageHistory = z.infer<typeof insertMessageHistorySchema>;
export type MessageHistory = typeof messageHistory.$inferSelect;

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertContactTag = z.infer<typeof insertContactTagSchema>;
export type ContactTag = typeof contactTags.$inferSelect;

export type InsertContactToTag = z.infer<typeof insertContactToTagSchema>;
export type ContactToTag = typeof contactsToTags.$inferSelect;
