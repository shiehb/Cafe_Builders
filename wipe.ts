import { getDb } from './src/lib/prisma';
async function clean() {
  const db = getDb();
  await db.$executeRawUnsafe('TRUNCATE TABLE categories CASCADE;');
  await db.$executeRawUnsafe('TRUNCATE TABLE ingredients CASCADE;');
  await db.$executeRawUnsafe('TRUNCATE TABLE customization_groups CASCADE;');
  await db.$executeRawUnsafe('TRUNCATE TABLE orders CASCADE;');
  console.log('Cleaned db');
}
clean().catch(console.error);
