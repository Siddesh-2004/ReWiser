// src/index.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from './db';
import app from './app';

async function checkDb(): Promise<void> {
  await db.execute(sql`select 1`);
  console.log('Database connected');
}

async function start() {
  try {
    await checkDb();
  } catch (err) {
    console.error('Database is not reachable:', err);
    process.exit(1);
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

start();