# Backend Zeplo

Backend para a plataforma de integração WhatsApp Zeplo.

## 🛠️ Stack de Tecnologia

- **Node.js** com **TypeScript**
- **Express.js** para servidor API
- **Knex.js** para consultas e migrações de banco de dados
- **PostgreSQL** como banco de dados principal
- **Redis** para cache e gerenciamento de sessão
- **MinIO** para armazenamento compatível com S3
- **Evolution API** para integração com WhatsApp

## 📋 Pré-requisitos

- Node.js 18.x ou superior
- PostgreSQL 13.x ou superior
- Redis 6.x ou superior
- Servidor MinIO ou armazenamento compatível com S3
- Acesso à Evolution API (integração WhatsApp)

## 🔧 Instalação

1. Clone o repositório
2. Instale as dependências:

```bash
npm install
```

3. Crie um arquivo `.env` no diretório raiz com suas variáveis de ambiente (veja `.env.example`)
4. Execute as migrações do banco de dados:

```bash
npm run migrate
```

5. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

## 🚀 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento com recarga automática
- `npm run build` - Compila o código TypeScript
- `npm run start` - Inicia o servidor de produção
- `npm run check` - Verificação de tipos TypeScript
- `npm run migrate` - Executa migrações de banco de dados
- `npm run migrate:rollback` - Reverte a última migração
- `npm run webhook` - Inicia o servidor de webhook dedicado
- `npm run lint` - Executa o ESLint
- `npm run lint:fix` - Corrige problemas do ESLint automaticamente

## 🧪 Testes

### Testes Unitários

Execute testes unitários com Jest:

```bash
npm test
```

Modo de observação para desenvolvimento:

```bash
npm run test:watch
```

### Testes de Integração

O projeto inclui vários scripts de teste para verificar conexões e funcionalidades:

- `npm run test:db` - Testa a conexão com o banco de dados
- `npm run test:redis` - Testa a conexão e operações do Redis
- `npm run test:minio` - Testa a conexão e operações do MinIO/S3
- `npm run test:evolution` - Testa a integração com a Evolution API
- `npm run test:webhook` - Testa a funcionalidade do servidor webhook
- `npm run test:api` - Testa os endpoints da API interna
- `npm run test:all` - Executa todos os testes de integração em sequência

## 📚 Documentação da API

A documentação da API está disponível em `/docs` quando o servidor está em execução no modo de desenvolvimento.

## 📁 Estrutura do Projeto

- `/src` - Código-fonte
  - `/api` - Rotas e controladores da API
  - `/config` - Arquivos de configuração
  - `/controllers` - Manipuladores de requisições
  - `/database` - Migrações e modelos do banco de dados
  - `/dtos` - Objetos de transferência de dados
  - `/middleware` - Middleware do Express
  - `/services` - Lógica de negócios
  - `/types` - Definições de tipos TypeScript
  - `/utils` - Funções utilitárias
- `/scripts` - Scripts utilitários
- `/dist` - Código JavaScript compilado (gerado)

## 🔒 Variáveis de Ambiente

Crie um arquivo `.env` no diretório raiz com as seguintes variáveis:

```
# Configuração do Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_USER=seu_usuario_db
DB_PASSWORD=sua_senha_db
DB_NAME=zeplo

# Ambiente
NODE_ENV=development
PORT=8080

# Configuração do MinIO
MINIO_ENDPOINT=https://seu-endpoint-minio
MINIO_ACCESS_KEY=sua_chave_acesso
MINIO_SECRET_KEY=sua_chave_secreta
MINIO_BUCKET=seu_nome_bucket

# Configuração Evolution API
EVOLUTION_API_URL=https://sua-url-evolution-api
EVOLUTION_API_KEY=sua_chave_api

# Configuração de Webhook
WEBHOOK_URL=http://localhost:3001/webhook
WEBHOOK_ENABLED=true
WEBHOOK_PORT=3001

# Configuração do Cache Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_REDIS_ENABLED=true
CACHE_REDIS_PREFIX_KEY=zeplo

# Segurança
JWT_SECRET=seu_segredo_jwt_aqui
SESSION_SECRET=seu_segredo_sessao_aqui

# Logging
LOG_LEVEL=info
```

## 🛡️ Segurança

- Todos os endpoints da API, exceto os públicos, exigem autenticação JWT
- Senhas são criptografadas usando bcrypt
- Variáveis de ambiente são usadas para informações sensíveis

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes. 