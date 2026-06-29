import { getDb } from "./client";
import { appSettings } from "./schema";
import { eq } from "drizzle-orm";

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key));

  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  const updatedAt = new Date().toISOString();

  await db
    .insert(appSettings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt },
    });
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(appSettings).where(eq(appSettings.key, key));
}
