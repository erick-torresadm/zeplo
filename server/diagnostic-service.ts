/**
 * Serviço de diagnóstico do sistema
 * 
 * Este serviço realiza verificações completas do ambiente, conexões
 * e componentes do sistema para facilitar a depuração de problemas.
 */

import { evolutionApi } from "./evolution-api";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import os from "os";
import axios from "axios";
import { messageFlows, users, instances, messageHistory } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Níveis de severidade para os resultados do diagnóstico
 */
export enum DiagnosticSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success'
}

/**
 * Estrutura para um resultado de verificação de diagnóstico
 */
export interface DiagnosticResult {
  name: string;
  description: string;
  status: 'success' | 'warning' | 'error' | 'info';
  details?: any;
  timestamp: Date;
  category: string;
  subCategory?: string;
}

/**
 * Classe principal do serviço de diagnóstico 
 */
export class DiagnosticService {
  /**
   * Executa um diagnóstico completo do sistema
   */
  async runCompleteDiagnostic(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    // Adicionar informações do sistema
    results.push(...await this.checkSystemInfo());
    
    // Verificar sistema de arquivos
    results.push(...await this.runFilesystemDiagnostic());
    
    // Verificar conexão com o banco de dados
    results.push(...await this.checkDatabaseConnection());
    
    // Verificar se as tabelas necessárias existem
    results.push(...await this.checkDatabaseTables());
    
    // Verificar conexão com a Evolution API
    results.push(...await this.checkEvolutionApiConnection());
    
    // Verificar instâncias configuradas
    results.push(...await this.checkInstances());
    
    // Verificar fluxos de mensagens configurados
    results.push(...await this.checkMessageFlows());

    // Armazenar os resultados na variável global
    global.latestDiagnosticResults = results;
    
    return results;
  }
  
  /**
   * Executa um diagnóstico do sistema de arquivos
   * Verifica diretórios temporários, arquivos de log e permissões
   */
  async runFilesystemDiagnostic(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    const fs = require('fs').promises;
    const path = require('path');
    
    // Verificar diretórios comuns
    const dirsToCheck = [
      { path: '.', name: 'Diretório raiz' },
      { path: 'public', name: 'Diretório de arquivos públicos' },
      { path: 'client', name: 'Diretório do cliente' },
      { path: 'server', name: 'Diretório do servidor' },
      { path: 'temp', name: 'Diretório temporário', optional: true }
    ];
    
    for (const dir of dirsToCheck) {
      try {
        const stats = await fs.stat(dir.path);
        const isDirectory = stats.isDirectory();
        
        if (isDirectory) {
          // Diretório existe, verificar permissões
          try {
            // Verificar se podemos listar conteúdo
            const files = await fs.readdir(dir.path);
            
            results.push({
              name: `${dir.name} - Acesso`,
              description: `Acesso confirmado ao diretório ${dir.path} (${files.length} arquivos/diretórios)`,
              status: "success",
              details: {
                path: dir.path,
                fileCount: files.length,
                isDirectory: true,
                permissions: {
                  read: true,
                  write: true // Assumimos que se podemos ler, também podemos escrever
                }
              },
              timestamp: new Date(),
              category: "filesystem",
              subCategory: "access"
            });
          } catch (error) {
            results.push({
              name: `${dir.name} - Acesso`,
              description: `Permissão negada para acessar ${dir.path}: ${error.message}`,
              status: "error",
              details: {
                path: dir.path,
                error: error.message
              },
              timestamp: new Date(),
              category: "filesystem",
              subCategory: "access"
            });
          }
        } else {
          // Não é um diretório
          results.push({
            name: `${dir.name} - Tipo`,
            description: `${dir.path} existe mas não é um diretório`,
            status: "warning",
            details: {
              path: dir.path,
              isDirectory: false
            },
            timestamp: new Date(),
            category: "filesystem",
            subCategory: "type"
          });
        }
      } catch (error) {
        // Diretório não existe
        if (dir.optional) {
          results.push({
            name: `${dir.name} - Existência`,
            description: `Diretório opcional ${dir.path} não existe`,
            status: "info",
            details: {
              path: dir.path,
              optional: true,
              error: error.message
            },
            timestamp: new Date(),
            category: "filesystem",
            subCategory: "existence"
          });
        } else {
          results.push({
            name: `${dir.name} - Existência`,
            description: `Diretório ${dir.path} não existe: ${error.message}`,
            status: "error",
            details: {
              path: dir.path,
              error: error.message
            },
            timestamp: new Date(),
            category: "filesystem",
            subCategory: "existence"
          });
        }
      }
    }
    
    // Verificar espaço em disco
    try {
      const { execSync } = require('child_process');
      const diskSpace = execSync('df -h .').toString();
      
      // Extrair informações relevantes usando regex
      const lines = diskSpace.split('\n').filter(line => line.trim() !== '');
      if (lines.length > 1) {
        const diskInfo = lines[1].split(/\s+/);
        const total = diskInfo[1] || 'N/A';
        const used = diskInfo[2] || 'N/A';
        const available = diskInfo[3] || 'N/A';
        const usedPercentage = diskInfo[4] || 'N/A';
        
        // Determinar o status com base na porcentagem usada
        let status = "success";
        if (usedPercentage.includes('%')) {
          const percentage = parseInt(usedPercentage.replace('%', ''));
          if (percentage > 90) status = "error";
          else if (percentage > 70) status = "warning";
        }
        
        results.push({
          name: "Espaço em Disco",
          description: `Utilização: ${usedPercentage} (Total: ${total}, Disponível: ${available})`,
          status,
          details: {
            filesystem: diskInfo[0] || 'N/A',
            total,
            used,
            available,
            usedPercentage
          },
          timestamp: new Date(),
          category: "filesystem",
          subCategory: "diskspace"
        });
      }
    } catch (error) {
      results.push({
        name: "Espaço em Disco",
        description: `Erro ao verificar espaço em disco: ${error.message}`,
        status: "warning",
        details: {
          error: error.message
        },
        timestamp: new Date(),
        category: "filesystem",
        subCategory: "diskspace"
      });
    }
    
    return results;
  }

  /**
   * Verifica informações do sistema e ambiente
   */
  async checkSystemInfo(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    // Verificar versões de Node.js e sistema operacional
    results.push({
      name: "Versão do Node.js",
      description: `Node.js ${process.version}`,
      status: "info",
      details: {
        version: process.version,
        arch: process.arch,
        platform: process.platform
      },
      timestamp: new Date(),
      category: "system",
      subCategory: "environment"
    });
    
    // Informações sobre o sistema operacional
    results.push({
      name: "Sistema Operacional",
      description: `${os.type()} ${os.release()}`,
      status: "info",
      details: {
        type: os.type(),
        release: os.release(),
        platform: os.platform(),
        arch: os.arch()
      },
      timestamp: new Date(),
      category: "system",
      subCategory: "environment"
    });
    
    // Verificar memória disponível
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const percentFree = Math.round((freeMemory / totalMemory) * 100);
    
    results.push({
      name: "Memória do Sistema",
      description: `Livre: ${Math.round(freeMemory / 1024 / 1024)}MB / Total: ${Math.round(totalMemory / 1024 / 1024)}MB (${percentFree}%)`,
      status: percentFree < 10 ? "warning" : "info",
      details: {
        total: totalMemory,
        free: freeMemory,
        percentFree: percentFree
      },
      timestamp: new Date(),
      category: "system",
      subCategory: "resources"
    });
    
    // Verificar tempo de atividade
    const uptime = os.uptime();
    results.push({
      name: "Tempo de Atividade",
      description: `${Math.floor(uptime / 3600)} horas, ${Math.floor((uptime % 3600) / 60)} minutos`,
      status: "info",
      details: {
        uptime: uptime
      },
      timestamp: new Date(),
      category: "system",
      subCategory: "resources"
    });

    // Verificar variáveis de ambiente críticas
    const requiredEnvVars = ['API_KEY', 'API_URL', 'DATABASE_URL'];
    const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
    
    results.push({
      name: "Variáveis de Ambiente",
      description: missingEnvVars.length === 0 
        ? "Todas as variáveis de ambiente necessárias estão configuradas"
        : `Faltam variáveis de ambiente: ${missingEnvVars.join(', ')}`,
      status: missingEnvVars.length === 0 ? "success" : "error",
      details: {
        missing: missingEnvVars,
        required: requiredEnvVars
      },
      timestamp: new Date(),
      category: "system",
      subCategory: "environment"
    });
    
    return results;
  }

  /**
   * Verifica conexão com o banco de dados
   */
  async checkDatabaseConnection(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    try {
      // Executar uma query simples para verificar a conexão
      const startTime = Date.now();
      const result = await db.execute(sql`SELECT 1 as connected`);
      const elapsed = Date.now() - startTime;
      
      results.push({
        name: "Conexão com o Banco de Dados",
        description: `Conexão estabelecida em ${elapsed}ms`,
        status: "success",
        details: {
          responseTime: elapsed,
          connected: true
        },
        timestamp: new Date(),
        category: "database",
        subCategory: "connection"
      });
    } catch (error) {
      results.push({
        name: "Conexão com o Banco de Dados",
        description: `Falha ao conectar ao banco de dados: ${error.message}`,
        status: "error",
        details: {
          error: error.message,
          connected: false
        },
        timestamp: new Date(),
        category: "database",
        subCategory: "connection"
      });
    }
    
    return results;
  }

  /**
   * Verifica se as tabelas necessárias existem no banco de dados
   */
  async checkDatabaseTables(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    try {
      // Verificar as principais tabelas do sistema
      const requiredTables = ['users', 'instances', 'message_flows', 'message_history'];
      const existingTables = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      const existingTableNames = existingTables.rows.map(row => row.table_name);
      const missingTables = requiredTables.filter(t => !existingTableNames.includes(t));
      
      results.push({
        name: "Tabelas do Banco de Dados",
        description: missingTables.length === 0 
          ? "Todas as tabelas necessárias existem no banco de dados" 
          : `Faltam tabelas no banco de dados: ${missingTables.join(', ')}`,
        status: missingTables.length === 0 ? "success" : "error",
        details: {
          required: requiredTables,
          existing: existingTableNames,
          missing: missingTables
        },
        timestamp: new Date(),
        category: "database",
        subCategory: "schema"
      });
      
      // Verificar contagens de registros nas tabelas principais
      if (missingTables.length === 0) {
        const userCount = await db.select({ count: sql`count(*)` }).from(users);
        const instanceCount = await db.select({ count: sql`count(*)` }).from(instances);
        const flowCount = await db.select({ count: sql`count(*)` }).from(messageFlows);
        const messageCount = await db.select({ count: sql`count(*)` }).from(messageHistory);
        
        results.push({
          name: "Contagem de Registros",
          description: `Usuários: ${userCount[0].count}, Instâncias: ${instanceCount[0].count}, Fluxos: ${flowCount[0].count}, Mensagens: ${messageCount[0].count}`,
          status: "info",
          details: {
            users: Number(userCount[0].count),
            instances: Number(instanceCount[0].count),
            flows: Number(flowCount[0].count),
            messages: Number(messageCount[0].count)
          },
          timestamp: new Date(),
          category: "database",
          subCategory: "data"
        });
      }
    } catch (error) {
      results.push({
        name: "Tabelas do Banco de Dados",
        description: `Erro ao verificar tabelas: ${error.message}`,
        status: "error",
        details: {
          error: error.message
        },
        timestamp: new Date(),
        category: "database",
        subCategory: "schema"
      });
    }
    
    return results;
  }

  /**
   * Verifica conexão com a Evolution API
   */
  async checkEvolutionApiConnection(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    try {
      // Verificar se a URL da API está configurada
      if (!process.env.API_URL) {
        results.push({
          name: "Configuração da Evolution API",
          description: "URL da Evolution API não configurada (API_URL)",
          status: "error",
          details: {
            error: "Missing API_URL environment variable"
          },
          timestamp: new Date(),
          category: "evolution-api",
          subCategory: "config"
        });
        return results;
      }
      
      // Testar a conexão com a API
      const startTime = Date.now();
      const response = await evolutionApi.getAllInstances();
      const elapsed = Date.now() - startTime;
      
      results.push({
        name: "Conexão com a Evolution API",
        description: `Conexão estabelecida em ${elapsed}ms`,
        status: "success",
        details: {
          responseTime: elapsed,
          apiVersion: response.version || "Desconhecida",
          baseUrl: process.env.API_URL
        },
        timestamp: new Date(),
        category: "evolution-api",
        subCategory: "connection"
      });
      
      // Verificar o status da resposta
      if (!response.status) {
        results.push({
          name: "Resposta da Evolution API",
          description: `API retornou status falso: ${response.message}`,
          status: "warning",
          details: {
            message: response.message,
            status: response.status
          },
          timestamp: new Date(),
          category: "evolution-api",
          subCategory: "response"
        });
      }
    } catch (error) {
      results.push({
        name: "Conexão com a Evolution API",
        description: `Falha ao conectar à Evolution API: ${error.message}`,
        status: "error",
        details: {
          error: error.message,
          baseUrl: process.env.API_URL
        },
        timestamp: new Date(),
        category: "evolution-api",
        subCategory: "connection"
      });
    }
    
    return results;
  }

  /**
   * Verifica as instâncias configuradas
   */
  async checkInstances(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    try {
      // Buscar todas as instâncias no banco de dados (de todos os usuários)
      const dbInstances = await db.select().from(instances);
      
      if (dbInstances.length === 0) {
        results.push({
          name: "Instâncias Configuradas",
          description: "Nenhuma instância configurada no sistema",
          status: "warning",
          details: {
            count: 0
          },
          timestamp: new Date(),
          category: "instances",
          subCategory: "config"
        });
      } else {
        results.push({
          name: "Instâncias Configuradas",
          description: `${dbInstances.length} instância(s) configurada(s) no sistema`,
          status: "success",
          details: {
            count: dbInstances.length,
            instances: dbInstances.map(i => i.name)
          },
          timestamp: new Date(),
          category: "instances",
          subCategory: "config"
        });
        
        // Verificar cada instância na Evolution API
        for (const instance of dbInstances) {
          try {
            const response = await evolutionApi.checkConnectionState(instance.name);
            
            if (response.status) {
              const state = response.state?.state?.toLowerCase() || 'desconhecido';
              const connected = state === 'open' || state === 'connected';
              
              results.push({
                name: `Instância ${instance.name}`,
                description: `Estado: ${connected ? 'Conectada' : 'Desconectada'} (${state})`,
                status: connected ? "success" : "warning",
                details: {
                  name: instance.name,
                  state: state,
                  connected: connected,
                  fullState: response.state
                },
                timestamp: new Date(),
                category: "instances",
                subCategory: "status"
              });
            } else {
              results.push({
                name: `Instância ${instance.name}`,
                description: `Erro ao verificar estado: ${response.message}`,
                status: "error",
                details: {
                  name: instance.name,
                  error: response.message
                },
                timestamp: new Date(),
                category: "instances",
                subCategory: "status"
              });
            }
          } catch (error) {
            results.push({
              name: `Instância ${instance.name}`,
              description: `Exceção ao verificar instância: ${error.message}`,
              status: "error",
              details: {
                name: instance.name,
                error: error.message
              },
              timestamp: new Date(),
              category: "instances",
              subCategory: "status"
            });
          }
        }
      }
      
      // Verificar instâncias existentes na Evolution API, mas não no sistema
      try {
        const apiResponse = await evolutionApi.getAllInstances();
        
        if (apiResponse.status && apiResponse.response) {
          const apiInstances = apiResponse.response;
          const dbInstanceNames = dbInstances.map(i => i.name);
          const orphanedInstances = apiInstances
            .filter(i => !dbInstanceNames.includes(i.instance?.instanceName))
            .map(i => i.instance?.instanceName);
          
          if (orphanedInstances.length > 0) {
            results.push({
              name: "Instâncias Órfãs",
              description: `${orphanedInstances.length} instância(s) existe(m) na Evolution API mas não no sistema: ${orphanedInstances.join(', ')}`,
              status: "warning",
              details: {
                count: orphanedInstances.length,
                orphanedInstances: orphanedInstances
              },
              timestamp: new Date(),
              category: "instances",
              subCategory: "orphaned"
            });
          }
        }
      } catch (error) {
        // Error ao verificar instâncias órfãs já foi reportado no check de conexão com API
      }
    } catch (error) {
      results.push({
        name: "Instâncias Configuradas",
        description: `Erro ao verificar instâncias: ${error.message}`,
        status: "error",
        details: {
          error: error.message
        },
        timestamp: new Date(),
        category: "instances",
        subCategory: "config"
      });
    }
    
    return results;
  }

  /**
   * Verifica os fluxos de mensagens configurados
   */
  async checkMessageFlows(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    try {
      // Buscar fluxos no banco de dados
      const flowsResult = await db.select().from(messageFlows);
      const flows = flowsResult || [];
      
      if (flows.length === 0) {
        results.push({
          name: "Fluxos de Mensagens",
          description: "Nenhum fluxo de mensagens configurado no sistema",
          status: "warning",
          details: {
            count: 0
          },
          timestamp: new Date(),
          category: "flows",
          subCategory: "config"
        });
      } else {
        results.push({
          name: "Fluxos de Mensagens",
          description: `${flows.length} fluxo(s) de mensagens configurado(s)`,
          status: "success",
          details: {
            count: flows.length,
            flowNames: flows.map(f => f.name)
          },
          timestamp: new Date(),
          category: "flows",
          subCategory: "config"
        });
        
        // Verificar a estrutura de cada fluxo
        let invalidFlows = 0;
        
        for (const flow of flows) {
          try {
            // Verificar se o fluxo tem mensagens válidas
            if (!flow.messages || flow.messages === "[]") {
              invalidFlows++;
              results.push({
                name: `Fluxo: ${flow.name}`,
                description: "Fluxo não contém mensagens",
                status: "warning",
                details: {
                  flowId: flow.id,
                  flowName: flow.name,
                  userId: flow.userId,
                  instanceId: flow.instanceId,
                  messages: flow.messages
                },
                timestamp: new Date(),
                category: "flows",
                subCategory: "validation"
              });
              continue;
            }
            
            // Verificar se o payload JSON é válido
            let messages = [];
            try {
              messages = JSON.parse(flow.messages);
              
              if (!Array.isArray(messages) || messages.length === 0) {
                invalidFlows++;
                results.push({
                  name: `Fluxo: ${flow.name}`,
                  description: "Fluxo tem uma estrutura de mensagens inválida",
                  status: "warning",
                  details: {
                    flowId: flow.id,
                    flowName: flow.name,
                    messages: messages,
                    error: "Não é um array ou está vazio"
                  },
                  timestamp: new Date(),
                  category: "flows",
                  subCategory: "validation"
                });
                continue;
              }
            } catch (parseError) {
              invalidFlows++;
              results.push({
                name: `Fluxo: ${flow.name}`,
                description: `Erro ao analisar JSON das mensagens: ${parseError.message}`,
                status: "error",
                details: {
                  flowId: flow.id,
                  flowName: flow.name,
                  error: parseError.message,
                  rawMessages: flow.messages
                },
                timestamp: new Date(),
                category: "flows",
                subCategory: "validation"
              });
              continue;
            }
            
            // Verificar se a instância associada existe
            const instance = await storage.getInstance(flow.instanceId);
            if (!instance) {
              results.push({
                name: `Fluxo: ${flow.name}`,
                description: "Fluxo está associado a uma instância inexistente",
                status: "error",
                details: {
                  flowId: flow.id,
                  flowName: flow.name,
                  instanceId: flow.instanceId
                },
                timestamp: new Date(),
                category: "flows",
                subCategory: "validation"
              });
            }
          } catch (error) {
            results.push({
              name: `Fluxo: ${flow.name}`,
              description: `Erro ao validar fluxo: ${error.message}`,
              status: "error",
              details: {
                flowId: flow.id,
                flowName: flow.name,
                error: error.message
              },
              timestamp: new Date(),
              category: "flows",
              subCategory: "validation"
            });
          }
        }
        
        // Resumo da validação dos fluxos
        if (invalidFlows > 0) {
          results.push({
            name: "Validação de Fluxos",
            description: `${invalidFlows} de ${flows.length} fluxos têm problemas`,
            status: "warning",
            details: {
              total: flows.length,
              invalid: invalidFlows,
              valid: flows.length - invalidFlows
            },
            timestamp: new Date(),
            category: "flows",
            subCategory: "summary"
          });
        } else {
          results.push({
            name: "Validação de Fluxos",
            description: "Todos os fluxos são válidos",
            status: "success",
            details: {
              total: flows.length,
              invalid: 0,
              valid: flows.length
            },
            timestamp: new Date(),
            category: "flows",
            subCategory: "summary"
          });
        }
      }
    } catch (error) {
      results.push({
        name: "Fluxos de Mensagens",
        description: `Erro ao verificar fluxos: ${error.message}`,
        status: "error",
        details: {
          error: error.message
        },
        timestamp: new Date(),
        category: "flows",
        subCategory: "config"
      });
    }
    
    return results;
  }

  /**
   * Executa um diagnóstico específico para uma instância
   */
  async runInstanceDiagnostic(instanceId: string): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    try {
      // Verificar se a instância existe
      const instance = await storage.getInstance(instanceId);
      
      if (!instance) {
        results.push({
          name: "Instância",
          description: `Instância com ID ${instanceId} não encontrada`,
          status: "error",
          details: {
            instanceId: instanceId
          },
          timestamp: new Date(),
          category: "instance-specific",
          subCategory: "existence"
        });
        return results;
      }
      
      // Informações da instância
      results.push({
        name: "Informações da Instância",
        description: `ID: ${instance.id}, Nome: ${instance.name}, Status: ${instance.status}`,
        status: "info",
        details: instance,
        timestamp: new Date(),
        category: "instance-specific",
        subCategory: "info"
      });
      
      // Verificar estado de conexão
      try {
        const connectionResponse = await evolutionApi.checkConnectionState(instance.name);
        
        if (connectionResponse.status) {
          const state = connectionResponse.state?.state?.toLowerCase() || 'desconhecido';
          const connected = state === 'open' || state === 'connected';
          
          results.push({
            name: "Estado de Conexão",
            description: `Estado: ${connected ? 'Conectada' : 'Desconectada'} (${state})`,
            status: connected ? "success" : "warning",
            details: {
              state: state,
              connected: connected,
              fullState: connectionResponse.state
            },
            timestamp: new Date(),
            category: "instance-specific",
            subCategory: "connection"
          });
        } else {
          results.push({
            name: "Estado de Conexão",
            description: `Erro ao verificar estado: ${connectionResponse.message}`,
            status: "error",
            details: {
              error: connectionResponse.message
            },
            timestamp: new Date(),
            category: "instance-specific",
            subCategory: "connection"
          });
        }
      } catch (error) {
        results.push({
          name: "Estado de Conexão",
          description: `Exceção ao verificar conexão: ${error.message}`,
          status: "error",
          details: {
            error: error.message
          },
          timestamp: new Date(),
          category: "instance-specific",
          subCategory: "connection"
        });
      }
      
      // Verificar contatos
      try {
        const contactsResponse = await evolutionApi.getAllContacts(instance.name);
        
        if (contactsResponse.status) {
          const contactCount = contactsResponse.response?.length || 0;
          
          results.push({
            name: "Contatos",
            description: `${contactCount} contatos encontrados`,
            status: "info",
            details: {
              count: contactCount
            },
            timestamp: new Date(),
            category: "instance-specific",
            subCategory: "contacts"
          });
        } else {
          results.push({
            name: "Contatos",
            description: `Erro ao buscar contatos: ${contactsResponse.message}`,
            status: "error",
            details: {
              error: contactsResponse.message
            },
            timestamp: new Date(),
            category: "instance-specific",
            subCategory: "contacts"
          });
        }
      } catch (error) {
        results.push({
          name: "Contatos",
          description: `Exceção ao buscar contatos: ${error.message}`,
          status: "error",
          details: {
            error: error.message
          },
          timestamp: new Date(),
          category: "instance-specific",
          subCategory: "contacts"
        });
      }
      
      // Verificar fluxos associados
      try {
        const flows = await storage.getMessageFlowsByInstanceId(instanceId);
        
        if (flows.length === 0) {
          results.push({
            name: "Fluxos Associados",
            description: "Nenhum fluxo de mensagens associado a esta instância",
            status: "warning",
            details: {
              count: 0
            },
            timestamp: new Date(),
            category: "instance-specific",
            subCategory: "flows"
          });
        } else {
          results.push({
            name: "Fluxos Associados",
            description: `${flows.length} fluxo(s) associado(s) a esta instância`,
            status: "success",
            details: {
              count: flows.length,
              flows: flows.map(f => ({ id: f.id, name: f.name }))
            },
            timestamp: new Date(),
            category: "instance-specific",
            subCategory: "flows"
          });
        }
      } catch (error) {
        results.push({
          name: "Fluxos Associados",
          description: `Erro ao verificar fluxos associados: ${error.message}`,
          status: "error",
          details: {
            error: error.message
          },
          timestamp: new Date(),
          category: "instance-specific",
          subCategory: "flows"
        });
      }
      
      // Verificar histórico de mensagens
      try {
        const messageHistoryResult = await db.select({count: sql`count(*)`}).from(messageHistory).where(eq(messageHistory.instanceId, instanceId));
        const messageCount = messageHistoryResult[0]?.count ? Number(messageHistoryResult[0].count) : 0;
        
        results.push({
          name: "Histórico de Mensagens",
          description: `${messageCount} mensagens no histórico desta instância`,
          status: "info",
          details: {
            count: messageCount
          },
          timestamp: new Date(),
          category: "instance-specific",
          subCategory: "messages"
        });
      } catch (error) {
        results.push({
          name: "Histórico de Mensagens",
          description: `Erro ao verificar histórico de mensagens: ${error.message}`,
          status: "error",
          details: {
            error: error.message
          },
          timestamp: new Date(),
          category: "instance-specific",
          subCategory: "messages"
        });
      }
    } catch (error) {
      results.push({
        name: "Diagnóstico da Instância",
        description: `Erro geral no diagnóstico: ${error.message}`,
        status: "error",
        details: {
          error: error.message,
          instanceId: instanceId
        },
        timestamp: new Date(),
        category: "instance-specific",
        subCategory: "general"
      });
    }
    
    return results;
  }
}

// Exportar uma instância única do serviço de diagnóstico
export const diagnosticService = new DiagnosticService();