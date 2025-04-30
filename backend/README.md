# Zeplo Backend

Backend for the Zeplo WhatsApp integration platform.

## 🛠️ Technology Stack

- **Node.js** with **TypeScript**
- **Express.js** for API server
- **Knex.js** for database queries and migrations
- **PostgreSQL** as the main database
- **Redis** for caching and session management
- **MinIO** for S3-compatible object storage
- **Evolution API** for WhatsApp integration

## 📋 Prerequisites

- Node.js 18.x or later
- PostgreSQL 13.x or later
- Redis 6.x or later
- MinIO server or S3-compatible storage
- Access to Evolution API (WhatsApp integration)

## 🔧 Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your environment variables (see `.env.example`)
4. Run database migrations:

```bash
npm run migrate
```

5. Start the development server:

```bash
npm run dev
```

## 🚀 Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build the TypeScript code
- `npm run start` - Start the production server
- `npm run check` - TypeScript type checking
- `npm run migrate` - Run database migrations
- `npm run migrate:rollback` - Rollback the latest migration
- `npm run webhook` - Start the dedicated webhook server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically

## 🧪 Testing

### Unit Tests

Run unit tests with Jest:

```bash
npm test
```

Watch mode for development:

```bash
npm run test:watch
```

### Integration Tests

The project includes several test scripts to verify connections and functionality:

- `npm run test:db` - Test database connection
- `npm run test:redis` - Test Redis connection and operations
- `npm run test:minio` - Test MinIO/S3 connection and operations
- `npm run test:evolution` - Test Evolution API integration
- `npm run test:webhook` - Test webhook server functionality
- `npm run test:api` - Test internal API endpoints
- `npm run test:all` - Run all integration tests in sequence

## 📚 API Documentation

The API documentation is available at `/docs` when the server is running in development mode.

## 📁 Project Structure

- `/src` - Source code
  - `/api` - API routes and controllers
  - `/config` - Configuration files
  - `/controllers` - Request handlers
  - `/database` - Database migrations and models
  - `/dtos` - Data transfer objects
  - `/middleware` - Express middleware
  - `/services` - Business logic
  - `/types` - TypeScript type definitions
  - `/utils` - Utility functions
- `/scripts` - Utility scripts
- `/dist` - Compiled JavaScript code (generated)

## 🔒 Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=zeplo

# Environment
NODE_ENV=development
PORT=8080

# MinIO Configuration
MINIO_ENDPOINT=https://your-minio-endpoint
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_BUCKET=your_bucket_name

# Evolution API Configuration
EVOLUTION_API_URL=https://your-evolution-api-url
EVOLUTION_API_KEY=your_api_key

# Webhook Configuration
WEBHOOK_URL=http://localhost:3001/webhook
WEBHOOK_ENABLED=true
WEBHOOK_PORT=3001

# Redis Cache Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_REDIS_ENABLED=true
CACHE_REDIS_PREFIX_KEY=zeplo

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Logging
LOG_LEVEL=info
```

## 🛡️ Security

- All API endpoints except public ones require JWT authentication
- Passwords are hashed using bcrypt
- Environment variables are used for sensitive information

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details. 