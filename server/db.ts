import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { log } from "./vite";
import 'dotenv/config';

// Obtém a URL do banco de dados a partir das variáveis de ambiente
export const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Cria o cliente postgres
const client = postgres(DATABASE_URL);
export const db = drizzle(client);

log("Database connection established", "db");