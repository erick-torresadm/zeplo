/**
 * Este script testa o formato de timestamp para logs
 */
import { db } from './db';
import { eq } from 'drizzle-orm';
import { activities, messageHistory, instances } from '../shared/schema';
import { formatDateBrazilian } from './formatters';

async function testTimestampFormat() {
  console.log('Iniciando teste de formato de timestamp...');
  
  // Formatar data no formato brasileiro
  const currentDate = new Date();
  const formattedDate = formatDateBrazilian(currentDate);
  
  console.log('Data atual (ISO):', currentDate.toISOString());
  console.log('Data formatada (BR):', formattedDate);
  
  // Inserir uma atividade de teste no banco de dados
  try {
    const result = await db.insert(activities).values({
      userId: 1,
      type: 'test',
      description: `Teste de formatação de timestamp: ${formattedDate}`,
      entityType: 'test',
      timestamp: currentDate,
      createdAt: currentDate
    }).returning();
    
    console.log('Atividade inserida com sucesso:', result);
  } catch (error) {
    console.error('Erro ao inserir atividade:', error);
  }
  
  // Exibir a atividade para verificar como o timestamp é armazenado
  try {
    const logs = await db.select().from(activities).limit(1);
    console.log('Última atividade inserida:', logs[0]);
    
    // Tentar formatar o timestamp armazenado
    if (logs.length > 0) {
      const storedTimestamp = new Date(logs[0].timestamp);
      const formattedStoredDate = formatDateBrazilian(storedTimestamp);
      
      console.log('Timestamp do banco (ISO):', storedTimestamp.toISOString());
      console.log('Timestamp do banco (BR):', formattedStoredDate);
    }
    
    // Também testar com a tabela de histórico de mensagens
    console.log('\nTestando com a tabela de histórico de mensagens:');
    
    // Primeiro, obter uma instância válida do banco de dados
    const existingInstances = await db.select().from(instances).limit(1);
    
    if (existingInstances.length === 0) {
      console.log('Nenhuma instância encontrada no banco de dados para testar');
      return;
    }
    
    const instance = existingInstances[0];
    console.log('Usando instância:', instance);
    
    const messageResult = await db.insert(messageHistory).values({
      userId: instance.userId,
      instanceId: instance.id,
      instanceName: instance.name,
      sender: '+5511999999999',
      messageContent: `Teste de timestamp formatado: ${formattedDate}`,
      status: 'no_match' as const,
      timestamp: currentDate
    }).returning();
    
    console.log('Mensagem inserida com sucesso:', messageResult);
    
    // Buscar pelo id específico da mensagem que acabou de ser inserida para garantir que estamos pegando a certa
    const messageId = messageResult[0].id;
    const messages = await db.select().from(messageHistory).where(eq(messageHistory.id, messageId));
    
    if (messages.length > 0) {
      const msgTimestamp = new Date(messages[0].timestamp);
      const formattedMsgDate = formatDateBrazilian(msgTimestamp);
      
      console.log('Timestamp da mensagem (ISO):', msgTimestamp.toISOString());
      console.log('Timestamp da mensagem (BR):', formattedMsgDate);
    }
  } catch (error) {
    console.error('Erro ao consultar logs:', error);
  }
}

// Executar o teste
testTimestampFormat().then(() => {
  console.log('Teste de timestamp concluído');
  process.exit(0);
}).catch((error) => {
  console.error('Erro no teste de timestamp:', error);
  process.exit(1);
});