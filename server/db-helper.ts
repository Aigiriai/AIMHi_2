// Helper to get database with schema for backward compatibility
import { getDatabase as getUnifiedDatabase } from './unified-db-manager';

export async function getDB() {
  const { db } = await getUnifiedDatabase();
  const schema = await import('../unified-schema');
  return { db, schema };
}
