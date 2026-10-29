// Resolves the PostgreSQL connection string. Besides DATABASE_URL, accepts the names that
// Vercel's database integrations (Neon, Vercel Postgres, Supabase) add automatically.
export const DATABASE_URL_NAMES = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"] as const;

export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  for (const name of DATABASE_URL_NAMES) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}
