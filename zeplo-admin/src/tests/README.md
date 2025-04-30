# Testes de Integração Zeplo

Este diretório contém os testes de integração para o sistema Zeplo, verificando a comunicação entre o frontend, backend e serviços externos.

## Estrutura

- `run-all-tests.ts` - Script principal que executa todos os testes
- `frontend-tests.ts` - Testes do frontend com o backend
- `backend-tests.ts` - Testes dos serviços do backend
- `utils.ts` - Utilitários compartilhados entre os testes
- `check-api.ts` - Script de diagnóstico para identificar problemas na API

## Como executar

Existem diferentes comandos para executar os testes:

```bash
# Executar todos os testes
npm run test:all

# Executar apenas os testes do frontend
npm run test:frontend

# Executar apenas os testes do backend
npm run test:backend

# Executar diagnóstico da API (recomendado para identificar problemas)
npm run test:diagnostic
```

## Configuração

Os testes usam as seguintes variáveis de ambiente:

- `NEXT_PUBLIC_API_URL` - URL base da API do backend (padrão: `http://localhost:8080`)
- `TEST_TOKEN` - Token de autenticação para testes (padrão: `demo-token-no-auth-needed`)

## Requisitos do Sistema

### Ambiente de Desenvolvimento
- Frontend: Porta 3000 (Next.js)
- Backend: Porta 8080 (Node.js/Express)
- Webhook Server: Porta 3001

### Serviços Necessários
- Banco de dados PostgreSQL
- Redis
- Armazenamento S3 (opcional)

## Status Atual

Após nossa análise, identificamos que:

1. O backend está rodando na porta 8080
2. O backend está respondendo a requisições HTTP
3. Há conexão com Redis e banco de dados no backend
4. As rotas da API não estão implementadas ou seguem um padrão diferente do esperado

As seguintes rotas da API estão faltando no backend:
- `/flows` - para gerenciamento de fluxos de conversa
- `/instances` - para gerenciamento de instâncias de WhatsApp
- `/contacts` - para gerenciamento de contatos
- `/system/database-status` - para verificação de status do banco de dados
- `/system/redis-status` - para verificação de status do Redis
- `/system/storage-status` - para verificação de status do armazenamento S3

As seguintes rotas do frontend ainda precisam ser implementadas:
- `/dashboard/instances`
- `/dashboard/contacts`
- `/dashboard/settings`

## O que os testes verificam

### Testes de Frontend
- Conexão com o backend
- Listagem, criação, edição e exclusão de fluxos de conversa
- Publicação de fluxos
- Listagem de instâncias WhatsApp

### Testes de Backend
- Conexão com o banco de dados
- Conexão com o Redis
- Conexão com o armazenamento S3
- Criação e gerenciamento de instâncias WhatsApp
- Criação e gerenciamento de fluxos de conversa
- Upload e gerenciamento de mídia
- Criação e gerenciamento de contatos
- Testes de webhook

## Resolução de Problemas

### Erros 404 nas rotas da API
- O backend está rodando, mas as rotas necessárias não estão implementadas
- Você precisa implementar as rotas no backend de acordo com as expectativas do frontend
- Para cada rota faltante, crie um controlador e middleware correspondentes no backend

### Erros 500 ao criar Flows
- Verifique a estrutura da tabela `flows` no banco de dados
- A tabela `flows` deve ter os campos: `name`, `is_draft` e `user_id`
- Não deve incluir o campo `description` (que foi removido em uma atualização recente)
- Se necessário, execute a migração de banco de dados: `npm run migrate:latest` no diretório do backend

### Páginas 404 no Frontend
O frontend ainda está em desenvolvimento, e algumas rotas retornam 404:
- `/dashboard/instances`
- `/dashboard/contacts`
- `/dashboard/settings`

Essas rotas devem ser implementadas antes de continuar com os testes relacionados.

### O backend não está respondendo
- Verifique se o servidor backend está rodando na porta correta (padrão: 8080)
- Verifique se o caminho base da API está configurado corretamente
- Se estiver usando uma porta diferente, ajuste a variável `NEXT_PUBLIC_API_URL`

## Próximos Passos

1. **Backend**: Implemente as rotas da API faltantes
2. **Frontend**: Implemente as páginas faltantes
3. **Database**: Atualize o esquema da tabela `flows` para corrigir o erro 500
4. **Testes**: Execute novamente os testes para verificar a integração

## Extendendo os Testes

Para adicionar novos testes:
1. Identifique a categoria adequada (frontend ou backend)
2. Adicione uma nova função de teste no arquivo correspondente
3. Siga o padrão existente de tratamento de erros e logs
4. Atualize o método `runTests()` para incluir seu novo teste 