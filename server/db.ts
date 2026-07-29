import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pkg from 'pg';
const { Pool: PgPool } = pkg;
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;
const isNeonDatabase = databaseUrl.includes('neon.tech');

let db: ReturnType<typeof drizzle> | ReturnType<typeof drizzlePg>;
let pool: NeonPool | InstanceType<typeof PgPool>;

if (isNeonDatabase) {
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: databaseUrl });
  db = drizzle({ client: pool as NeonPool, schema });
  console.log('[DB] Using Neon serverless driver');
} else {
  pool = new PgPool({ connectionString: databaseUrl });
  db = drizzlePg({ client: pool, schema });
  console.log('[DB] Using standard pg driver for local PostgreSQL');
}

export { pool, db };
