// gateway/redis/client.mjs — Redis client with graceful degradation

import { createClient } from 'redis';
import config from '../config.mjs';
import logger from '../logger.mjs';

let client = null;
let available = false;
let reconnectTimer = null;

export async function connectRedis() {
  try {
    client = createClient({ url: config.redis.url });
    client.on('error', (err) => {
      if (available) {
        logger.warn('Redis connection error', { error: err.message });
        available = false;
      }
    });
    client.on('ready', () => {
      available = true;
      logger.info('Redis connected', { url: config.redis.url });
    });
    client.on('end', () => {
      available = false;
    });
    await client.connect();
    available = true;
  } catch (err) {
    logger.warn('Redis not available, operating without cache', { error: err.message });
    available = false;
    // Schedule reconnect
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!available) {
      try {
        await connectRedis();
      } catch { /* logged above */ }
    }
  }, 30000);
}

export function isRedisAvailable() {
  return available && client && client.isReady;
}

export async function redisGet(key) {
  if (!isRedisAvailable()) return null;
  try {
    return await client.get(config.redis.prefix + key);
  } catch (err) {
    logger.debug('Redis GET error', { key, error: err.message });
    return null;
  }
}

export async function redisSet(key, value, ttlSeconds) {
  if (!isRedisAvailable()) return false;
  try {
    const opts = ttlSeconds ? { EX: ttlSeconds } : {};
    await client.set(config.redis.prefix + key, value, opts);
    return true;
  } catch (err) {
    logger.debug('Redis SET error', { key, error: err.message });
    return false;
  }
}

export async function redisDel(key) {
  if (!isRedisAvailable()) return false;
  try {
    await client.del(config.redis.prefix + key);
    return true;
  } catch (err) {
    logger.debug('Redis DEL error', { key, error: err.message });
    return false;
  }
}

export async function redisGetJson(key) {
  const raw = await redisGet(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function redisSetJson(key, value, ttlSeconds) {
  return redisSet(key, JSON.stringify(value), ttlSeconds);
}

export async function redisIncr(key, ttlSeconds) {
  if (!isRedisAvailable()) return null;
  try {
    const val = await client.incr(config.redis.prefix + key);
    if (ttlSeconds && val === 1) {
      await client.expire(config.redis.prefix + key, ttlSeconds);
    }
    return val;
  } catch (err) {
    logger.debug('Redis INCR error', { key, error: err.message });
    return null;
  }
}

export async function closeRedis() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (client) {
    try { await client.quit(); } catch { /* ok */ }
    client = null;
    available = false;
    logger.info('Redis disconnected');
  }
}

export function getRedisClient() {
  return client;
}
