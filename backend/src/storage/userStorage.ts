import { createClient } from 'redis';
import { User } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

/**
 * UserStorage with Redis and graceful in-memory fallback.
 */
class UserStorage {
  private static instance: UserStorage;
  private client: ReturnType<typeof createClient> | null = null;
  private readonly USER_TTL = 7 * 24 * 60 * 60; // seconds
  private useMemory = false;
  private memoryUsers = new Map<string, User & { _expiresAt: number }>();
  private providerIndex = new Map<string, string>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.setupRedis();
  }

  private setupRedis(): void {
    const urlFromEnv = process.env.REDIS_URL;
    try {
      if (urlFromEnv) {
        this.client = createClient({ url: urlFromEnv });
      } else {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT || '6379';
        const password = process.env.REDIS_PASSWORD || '';
        const authSegment = password ? `:${encodeURIComponent(password)}@` : '';
        const url = `redis://${authSegment}${host}:${port}`;
        this.client = createClient({ url });
      }
      this.client.on('error', err => {
        logger.error({ err }, 'Redis error (UserStorage)');
        if (!this.useMemory) {
          this.activateFallback('runtime-error');
        }
      });
      this.client.on('connect', () => {
        logger.info('UserStorage Redis connected');
      });
      void this.connect();
    } catch (error) {
      logger.error({ error }, 'Failed constructing Redis client');
      this.activateFallback('construction-error');
    }
  }

  private async connect(): Promise<void> {
    if (this.useMemory || !this.client) {
      return;
    }
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
    } catch (error) {
      logger.error({ error }, 'Redis connect failed (UserStorage)');
      this.activateFallback('connect-failure');
    }
  }

  private activateFallback(reason: string): void {
    if (this.useMemory) {
      return;
    }
    this.useMemory = true;
    logger.warn({ reason }, '⚠️ Falling back to in-memory UserStorage');
    this.cleanupInterval = setInterval(
      () => {
        const now = Date.now();
        for (const [id, u] of this.memoryUsers) {
          if (u._expiresAt <= now) {
            this.memoryUsers.delete(id);
          }
        }
        for (const [key, userId] of this.providerIndex) {
          if (!this.memoryUsers.get(userId)) {
            this.providerIndex.delete(key);
          }
        }
      },
      60 * 60 * 1000,
    ).unref();
  }

  static getInstance(): UserStorage {
    if (!this.instance) {
      this.instance = new UserStorage();
    }
    return this.instance;
  }

  async createUser(userData: {
    email: string;
    name: string;
    provider: string;
    providerId: string;
    avatar?: string;
  }): Promise<User> {
    await this.connect();
    const providerKey = `provider:${userData.provider}:${userData.providerId}`;
    let existingId: string | undefined | null = null;

    if (!this.useMemory && this.client) {
      existingId = await this.client.get(providerKey);
    } else {
      existingId = this.providerIndex.get(providerKey) || null;
    }
    if (existingId) {
      const existing = await this.getUser(existingId);
      if (existing) {
        existing.lastLoginAt = new Date();
        await this.updateUser(existing);
        return existing;
      }
    }

    const user: User = {
      id: uuidv4(),
      email: userData.email,
      name: userData.name,
      provider: userData.provider,
      providerId: userData.providerId,
      avatar: userData.avatar,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };
    if (!this.useMemory && this.client) {
      await this.client.setEx(
        `user:${user.id}`,
        this.USER_TTL,
        JSON.stringify(user),
      );
      await this.client.setEx(providerKey, this.USER_TTL, user.id);
    } else {
      const expiresAt = Date.now() + this.USER_TTL * 1000;
      this.memoryUsers.set(user.id, { ...user, _expiresAt: expiresAt });
      this.providerIndex.set(providerKey, user.id);
    }
    logger.info({ userId: user.id, memory: this.useMemory }, 'User created');
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    await this.connect();
    if (!this.useMemory && this.client) {
      const data = await this.client.get(`user:${userId}`);
      if (!data) {
        return null;
      }
      const user = JSON.parse(data) as User;
      user.createdAt = new Date(user.createdAt);
      if (user.lastLoginAt) {
        user.lastLoginAt = new Date(user.lastLoginAt);
      }
      return user;
    }
    const entry = this.memoryUsers.get(userId);
    if (!entry) {
      return null;
    }
    if (entry._expiresAt <= Date.now()) {
      this.memoryUsers.delete(userId);
      return null;
    }
    const { _expiresAt, ...user } = entry;
    return user;
  }

  async getUserByProvider(
    provider: string,
    providerId: string,
  ): Promise<User | null> {
    await this.connect();
    const providerKey = `provider:${provider}:${providerId}`;
    let userId: string | null | undefined;
    if (!this.useMemory && this.client) {
      userId = await this.client.get(providerKey);
    } else {
      userId = this.providerIndex.get(providerKey) || null;
    }
    if (!userId) {
      return null;
    }
    return this.getUser(userId);
  }

  async updateUser(user: User): Promise<void> {
    await this.connect();
    const providerKey = `provider:${user.provider}:${user.providerId}`;
    if (!this.useMemory && this.client) {
      await this.client.setEx(
        `user:${user.id}`,
        this.USER_TTL,
        JSON.stringify(user),
      );
      await this.client.setEx(providerKey, this.USER_TTL, user.id);
    } else {
      const expiresAt = Date.now() + this.USER_TTL * 1000;
      this.memoryUsers.set(user.id, { ...user, _expiresAt: expiresAt });
      this.providerIndex.set(providerKey, user.id);
    }
    logger.info({ userId: user.id, memory: this.useMemory }, 'User updated');
  }

  async deleteUser(userId: string): Promise<void> {
    await this.connect();
    const existing = await this.getUser(userId);
    if (!existing) {
      return;
    }
    const providerKey = `provider:${existing.provider}:${existing.providerId}`;
    if (!this.useMemory && this.client) {
      await this.client.del(`user:${userId}`);
      await this.client.del(providerKey);
    } else {
      this.memoryUsers.delete(userId);
      this.providerIndex.delete(providerKey);
    }
    logger.info({ userId, memory: this.useMemory }, 'User deleted');
  }

  async getAllUsers(limit: number = 100): Promise<User[]> {
    await this.connect();
    if (!this.useMemory && this.client) {
      const keys = await this.client.keys('user:*');
      const slice = keys.slice(0, limit);
      const users: User[] = [];
      for (const key of slice) {
        const data = await this.client.get(key);
        if (data) {
          const u = JSON.parse(data) as User;
          u.createdAt = new Date(u.createdAt);
          if (u.lastLoginAt) u.lastLoginAt = new Date(u.lastLoginAt);
          users.push(u);
        }
      }
      return users;
    }
    const now = Date.now();
    const users: User[] = [];
    for (const entry of Array.from(this.memoryUsers.values()).slice(0, limit)) {
      if (entry._expiresAt <= now) continue;
      const { _expiresAt, ...u } = entry;
      users.push(u);
    }
    return users;
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (!this.useMemory && this.client && this.client.isOpen)
      await this.client.quit();
  }
}

export default UserStorage.getInstance();
