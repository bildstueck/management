import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null, // required by BullMQ
    lazyConnect: true, // don't connect until the first command — avoids
    // build-time/module-load connection attempts in pages/actions that
    // merely import a BullMQ Queue without using it yet.
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
