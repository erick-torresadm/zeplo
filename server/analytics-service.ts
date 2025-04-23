import { db } from "./db";
import { activities, instances, messageFlows } from "@shared/schema";
import { count, eq, and, gt, lte, sql, isNull, isNotNull } from "drizzle-orm";
import { format, startOfDay, subDays, subWeeks, subMonths, subYears } from "date-fns";

/**
 * Serviço para fornecer dados para o dashboard de analytics
 */
export const analyticsService = {
  /**
   * Retorna um resumo geral das estatísticas
   */
  async getSummary(userId: number, period: string, instanceId?: string): Promise<any> {
    const startDate = getStartDateFromPeriod(period);

    // Total de mensagens processadas no período
    const totalMessagesResult = await db
      .select({ value: count() })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.type, "message_processed"),
          gt(activities.timestamp, startDate),
          instanceId ? eq(activities.instanceId, instanceId) : sql`true`
        )
      );
    
    // Quantidade de instâncias ativas
    const activeInstancesResult = await db
      .select({ value: count() })
      .from(instances)
      .where(
        and(
          eq(instances.userId, userId),
          eq(instances.status, "connected")
        )
      );
    
    // Fluxos de mensagens ativos
    const activeFlowsResult = await db
      .select({ value: count() })
      .from(messageFlows)
      .where(
        and(
          eq(messageFlows.userId, userId),
          eq(messageFlows.status, "active"),
          instanceId ? eq(messageFlows.instanceId, instanceId) : sql`true`
        )
      );
    
    // Taxa de sucesso (mensagens enviadas com sucesso vs falhas)
    const successMessagesResult = await db
      .select({ value: count() })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.type, "message_sent"),
          eq(activities.status, "success"),
          gt(activities.timestamp, startDate),
          instanceId ? eq(activities.instanceId, instanceId) : sql`true`
        )
      );
    
    const failedMessagesResult = await db
      .select({ value: count() })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.type, "message_sent"),
          eq(activities.status, "failed"),
          gt(activities.timestamp, startDate),
          instanceId ? eq(activities.instanceId, instanceId) : sql`true`
        )
      );
    
    const totalMessages = totalMessagesResult[0]?.value || 0;
    const activeInstances = activeInstancesResult[0]?.value || 0;
    const activeFlows = activeFlowsResult[0]?.value || 0;
    const successMessages = successMessagesResult[0]?.value || 0;
    const failedMessages = failedMessagesResult[0]?.value || 0;
    
    const successRate = totalMessages > 0 ? 
      Math.round((successMessages / (successMessages + failedMessages)) * 100) : 0;
    
    return {
      totalMessages,
      activeInstances,
      activeFlows,
      successRate
    };
  },

  /**
   * Retorna dados de volume de mensagens agrupados por período
   */
  async getMessageVolume(userId: number, period: string, instanceId?: string): Promise<any> {
    const startDate = getStartDateFromPeriod(period);
    const timeFormat = getTimeFormatFromPeriod(period);
    
    // Consulta para obter o volume de mensagens agrupado por período
    const result = await db.execute(sql`
      SELECT 
        date_trunc(${timeFormat}, activities.timestamp) as time_period,
        COUNT(*) as message_count
      FROM activities
      WHERE 
        activities.user_id = ${userId} AND
        activities.type = 'message_processed' AND
        activities.timestamp > ${startDate} 
        ${instanceId ? sql`AND activities.instance_id = ${instanceId}` : sql``}
      GROUP BY time_period
      ORDER BY time_period ASC
    `);
    
    // Formatar os dados para o frontend
    const formattedData = result.map((row: any) => {
      const date = new Date(row.time_period);
      return {
        period: format(date, period === '24h' ? 'HH:00' : 'dd/MM'),
        count: parseInt(row.message_count),
      };
    });
    
    return formattedData;
  },

  /**
   * Retorna dados de performance das instâncias
   */
  async getInstancesPerformance(userId: number, period: string): Promise<any> {
    const startDate = getStartDateFromPeriod(period);
    
    // Consulta para obter a contagem de mensagens por instância
    const result = await db.execute(sql`
      SELECT 
        instances.name as instance_name,
        instances.id as instance_id,
        COUNT(activities.id) as message_count
      FROM instances
      LEFT JOIN activities ON 
        instances.id = activities.instance_id AND
        activities.type = 'message_processed' AND
        activities.timestamp > ${startDate}
      WHERE instances.user_id = ${userId}
      GROUP BY instances.id, instances.name
      ORDER BY message_count DESC
    `);
    
    // Formatar os dados para o frontend
    const formattedData = result.map((row: any) => ({
      name: row.instance_name,
      id: row.instance_id,
      count: parseInt(row.message_count),
    }));
    
    return formattedData;
  },

  /**
   * Retorna dados de performance dos fluxos de mensagens
   */
  async getFlowsPerformance(userId: number, period: string, instanceId?: string): Promise<any> {
    const startDate = getStartDateFromPeriod(period);
    
    // Consulta para obter a contagem de acionamentos por fluxo
    const result = await db.execute(sql`
      SELECT 
        message_flows.name as flow_name,
        message_flows.id as flow_id,
        message_flows.keyword as keyword,
        COUNT(activities.id) as trigger_count
      FROM message_flows
      LEFT JOIN activities ON 
        message_flows.id = activities.flow_id AND
        activities.type = 'flow_triggered' AND
        activities.timestamp > ${startDate}
      WHERE 
        message_flows.user_id = ${userId}
        ${instanceId ? sql`AND message_flows.instance_id = ${instanceId}` : sql``}
      GROUP BY message_flows.id, message_flows.name, message_flows.keyword
      ORDER BY trigger_count DESC
    `);
    
    // Formatar os dados para o frontend
    const formattedData = result.map((row: any) => ({
      name: row.flow_name,
      id: row.flow_id,
      keyword: row.keyword,
      count: parseInt(row.trigger_count),
    }));
    
    return formattedData;
  },

  /**
   * Retorna dados sobre as palavras-chave mais acionadas
   */
  async getTopTriggers(userId: number, period: string, instanceId?: string): Promise<any> {
    const startDate = getStartDateFromPeriod(period);
    
    // Consulta para obter as palavras-chave mais acionadas
    const result = await db.execute(sql`
      SELECT 
        message_flows.keyword as trigger_keyword,
        COUNT(activities.id) as trigger_count,
        message_flows.name as flow_name,
        message_flows.id as flow_id,
        activities.status as status
      FROM activities
      JOIN message_flows ON 
        activities.flow_id = message_flows.id
      WHERE 
        activities.user_id = ${userId} AND
        activities.type = 'flow_triggered' AND
        activities.timestamp > ${startDate}
        ${instanceId ? sql`AND activities.instance_id = ${instanceId}` : sql``}
      GROUP BY message_flows.keyword, message_flows.name, message_flows.id, activities.status
      ORDER BY trigger_count DESC
      LIMIT 10
    `);
    
    // Formatar os dados para o frontend
    const formattedData = result.map((row: any) => ({
      keyword: row.trigger_keyword,
      count: parseInt(row.trigger_count),
      flowName: row.flow_name,
      flowId: row.flow_id,
      status: row.status
    }));
    
    return formattedData;
  }
};

/**
 * Função auxiliar para obter a data de início com base no período
 */
function getStartDateFromPeriod(period: string, multiplier: number = 1): Date {
  const now = new Date();
  
  let startDate: Date;
  
  switch (period) {
    case '24h':
      startDate = subDays(now, 1 * multiplier);
      break;
    case '7d':
      startDate = subDays(now, 7 * multiplier);
      break;
    case '30d':
      startDate = subDays(now, 30 * multiplier);
      break;
    case '90d':
      startDate = subDays(now, 90 * multiplier);
      break;
    case '6m':
      startDate = subMonths(now, 6 * multiplier);
      break;
    case '1y':
      startDate = subYears(now, 1 * multiplier);
      break;
    default:
      startDate = subDays(now, 7 * multiplier);
  }
  
  return startOfDay(startDate);
}

/**
 * Função auxiliar para obter o formato de tempo para agrupamento
 */
function getTimeFormatFromPeriod(period: string): string {
  switch (period) {
    case '24h':
      return 'hour';
    case '7d':
    case '30d':
      return 'day';
    case '90d':
    case '6m':
      return 'week';
    case '1y':
      return 'month';
    default:
      return 'day';
  }
}