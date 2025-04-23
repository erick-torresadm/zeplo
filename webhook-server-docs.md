# Servidor de Webhook Dedicado - Documentação

## Visão Geral

O servidor de webhook dedicado foi desenvolvido para resolver problemas de detecção de palavras-chave e processamento de mensagens em tempo real da Evolution API, operando independentemente da aplicação principal.

## Por que um servidor dedicado?

- **Desempenho**: Evita que o processamento de webhooks impacte a aplicação principal do frontend.
- **Confiabilidade**: Garante que os fluxos sejam acionados mesmo quando a interface não está sendo acessada.
- **Escalabilidade**: Permite escalar o processamento de mensagens independentemente do frontend.
- **Robustez**: Reduz problemas de detecção de palavras-chave garantindo consistência.

## Estrutura do Sistema

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Evolution API  │────▶│ Webhook Server  │────▶│  Aplicação Web  │
│                 │     │    (Listener)   │     │   (Processor)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Configuração e Uso

### Iniciando o Servidor

```bash
node start-webhook-server.js
```

Este comando inicia o servidor de webhook na porta 3001 (padrão).

### Variáveis de Ambiente

- `WEBHOOK_PORT`: Porta em que o servidor vai escutar (padrão: 3001)
- `FRONTEND_API_URL`: URL da API do frontend (padrão: http://localhost:3000/api)
- `API_KEY`: Chave de API para autenticação entre servidor webhook e frontend

### Endpoints Disponíveis

#### `/webhook` (POST)
Recebe os eventos da Evolution API.

#### `/status` (GET)
Retorna o status atual do servidor de webhook.

#### `/test` (POST)
Endpoint para testes, que ecoa a requisição recebida.

## Testando o Servidor

Para testar o servidor de webhook sem depender da Evolution API:

```bash
node test-webhook.js
```

Este script envia uma mensagem simulada para o servidor de webhook.

## Integração com a Aplicação Principal

O servidor de webhook recebe mensagens da Evolution API e as encaminha para o endpoint `/api/process-message` da aplicação principal, que processa a mensagem e aciona os fluxos correspondentes.

### Fluxo de Dados

1. Evolution API envia evento para `/webhook`
2. Servidor de webhook extrai dados importantes (número, texto, etc)
3. Servidor de webhook envia para `/api/process-message` na aplicação principal
4. Aplicação principal identifica palavras-chave e aciona fluxos
5. Fluxos são processados e respostas enviadas para o WhatsApp

## Solução de Problemas

### Logs

O servidor mantém logs detalhados no arquivo `webhook-logs.txt` na raiz do projeto.

### Verificando Status

```bash
curl http://localhost:3001/status
```

### Mensagem de Teste Manual

```bash
curl -X POST http://localhost:3001/test -H "Content-Type: application/json" -d '{"test": true}'
```

## Segurança

O servidor utiliza a mesma chave `API_KEY` que a aplicação principal para autenticar as requisições. Esta chave deve ser configurada como uma variável de ambiente.