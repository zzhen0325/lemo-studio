import { compare, hash } from 'bcryptjs';
import { HttpError } from '../utils/http-error';
import { UsersRepository, type UserRecord } from '../repositories';
import { tryNormalizeAssetUrlToCdn } from '../utils/cdn-image-url';
import { getFileUrl } from '@/src/storage/object-storage';

/**
 * Check if a string is a storage key (not a full URL)
 */
function isStorageKey(value: string): boolean {
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return false;
  }
  return value.includes('/');
}

/**
 * Get display URL from storage key or URL
 */
async function getDisplayUrl(value: string | undefined): Promise<string | undefined> {
  if (!value) return undefined;
  if (isStorageKey(value)) {
    return getFileUrl(value);
  }
  return value;
}

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  private toClientUser(user: UserRecord, avatar?: string): Record<string, unknown> {
    return {
      id: user.id,
      name: user.display_name,
      avatar,
      createdAt: user.created_at,
    };
  }

  private isHashedPassword(value?: string): boolean {
    return typeof value === 'string' && /^\$2[aby]\$/.test(value);
  }

  /**
   * Normalize avatar URL for storage and display
   * - Stores storage key (permanent)
   * - Returns display URL (temporary presigned URL)
   */
  private async normalizeAvatar(userId: string, avatar?: string | null): Promise<{ storageKey?: string; displayUrl?: string }> {
    if (!avatar) {
      return {};
    }

    // Try to normalize (upload local assets, extract storage key from presigned URL)
    const normalized = await tryNormalizeAssetUrlToCdn(avatar, {
      preferredSubdir: 'avatars',
      preferredFileName: `${userId}.png`,
    });

    const storageKey = normalized.storageKey || normalized.url;
    if (!storageKey) {
      return {};
    }

    // Get display URL from storage key
    const displayUrl = await getDisplayUrl(storageKey);

    // Update database if storage key changed
    if (storageKey !== avatar) {
      await this.usersRepository.updateProfile(userId, { avatar_url: storageKey });
    }

    return { storageKey, displayUrl };
  }

  public async getUserById(userId: string): Promise<Record<string, unknown> | null> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      return null;
    }
    const avatarResult = await this.normalizeAvatar(user.id, user.avatar_url);
    return this.toClientUser(user, avatarResult.displayUrl);
  }

  public async register(body: unknown): Promise<Record<string, unknown>> {
    try {
      const { username, password } = body as { username?: string; password?: string };

      if (!username || !password) {
        throw new HttpError(400, 'Missing credentials');
      }
      const exists = await this.usersRepository.findByDisplayName(username);
      if (exists) {
        throw new HttpError(409, 'Username already exists');
      }

      const userId = crypto.randomUUID();
      const newUser = await this.usersRepository.create({
        id: userId,
        display_name: username,
        password: await hash(password, 12),
        created_at: new Date().toISOString(),
      });

      return this.toClientUser(newUser);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('User registration failed', error);
      throw new HttpError(500, 'Registration failed');
    }
  }

  public async login(body: unknown): Promise<Record<string, unknown>> {
    try {
      const { username, password } = body as { username?: string; password?: string };
      if (!username || !password) {
        throw new HttpError(400, 'Missing credentials');
      }

      const user = await this.usersRepository.findByDisplayName(username);
      if (!user || !user.password) {
        throw new HttpError(401, 'Invalid credentials');
      }

      let passwordMatches = false;
      if (this.isHashedPassword(user.password)) {
        passwordMatches = await compare(password, user.password);
      } else {
        passwordMatches = user.password === password;
        if (passwordMatches) {
          await this.usersRepository.updateProfile(user.id, { password: await hash(password, 12) });
        }
      }

      if (!passwordMatches) {
        throw new HttpError(401, 'Invalid credentials');
      }

      const avatar = await getDisplayUrl(user.avatar_url);
      return this.toClientUser(user, avatar);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('User login failed', error);
      throw new HttpError(500, 'Login failed');
    }
  }

  public async updateUser(userId: string, body: unknown): Promise<Record<string, unknown>> {
    try {
      const { name, avatar } = body as {
        name?: string;
        avatar?: string;
      };

      const user = await this.usersRepository.findById(userId);
      if (!user) {
        throw new HttpError(404, 'User not found');
      }

      const updates: Partial<UserRecord> = {};
      let avatarDisplayUrl: string | undefined;
      
      if (name) updates.display_name = name;
      if (avatar !== undefined) {
        const avatarResult = await this.normalizeAvatar(userId, avatar);
        updates.avatar_url = avatarResult.storageKey;
        avatarDisplayUrl = avatarResult.displayUrl;
      }

      if (Object.keys(updates).length > 0) {
        await this.usersRepository.updateProfile(userId, updates);
      }

      return this.toClientUser(
        {
          ...user,
          ...updates,
        },
        avatarDisplayUrl || await getDisplayUrl(updates.avatar_url || user.avatar_url),
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Update user failed', error);
      throw new HttpError(500, 'Update failed');
    }
  }
}
