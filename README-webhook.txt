# Servidor de Webhook Dedicado - Documentação

## Visão Geral

O servidor de webhook dedicado foi desenvolvido para resolver problemas de detecção de palavras-chave e processamento de mensagens em tempo real da Evolution API, operando independentemente da aplicação principal.

## Por que um servidor dedicado?

- **Desempenho**: Evita que o processamento de webhooks impacte a aplicação principal do frontend.
- **Confiabilidade**: Garante que os fluxos sejam acionados mesmo quando a interface não está sendo acessada.
- **Escalabilidade**: Permite escalar o processamento de mensagens independentemente do frontend.
- **Robustez**: Reduz problemas de detecção de palavras-chave garantindo consistência.

## Configuração e Uso

### Iniciando o Servidor



Este comando inicia o servidor de webhook na porta 3001 (padrão).

### Variáveis de Ambiente

- WEBHOOK_PORT: Porta em que o servidor vai escutar (padrão: 3001)
- FRONTEND_API_URL: URL da API do frontend (padrão: http://localhost:3000/api)
- API_KEY: Chave de API para autenticação entre servidor webhook e frontend

### Endpoints Disponíveis

#### /webhook (POST)
Recebe os eventos da Evolution API.

#### /status (GET)
Retorna o status atual do servidor de webhook.

#### /test (POST)
Endpoint para testes, que ecoa a requisição recebida.

## Testando o Servidor

Para testar o servidor de webhook sem depender da Evolution API:


