import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

// Prisma 7: the CLI (migrate/studio/db seed) reads its connection URL from
// here instead of `schema.prisma`. The Prisma Client at runtime gets its own
// connection via a driver adapter — see src/lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
