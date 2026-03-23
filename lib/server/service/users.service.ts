import { HttpError } from '../utils/http-error';
import { UserModel, type UserDoc } from '../db/models';
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
      await UserModel.updateOne({ id: userId }, { avatar_url: storageKey });
    }

    return { storageKey, displayUrl };
  }

  public async getUsers(userId?: string | null): Promise<{ user?: Record<string, unknown>; users?: Record<string, unknown>[] }> {
    try {
      if (userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
          throw new HttpError(404, 'User not found');
        }
        const avatarResult = await this.normalizeAvatar(user.id, user.avatar_url);
        return {
          user: {
            id: user.id,
            name: user.display_name,
            avatar: avatarResult.displayUrl,
            createdAt: user.created_at,
          },
        };
      }

      const users = await UserModel.find();
      const safeUsers = await Promise.all(users.map(async (u: UserDoc) => {
        const avatarResult = await this.normalizeAvatar(u.id, u.avatar_url);
        return {
          id: u.id,
          name: u.display_name,
          avatar: avatarResult.displayUrl,
          createdAt: u.created_at,
        };
      }));
      return { users: safeUsers as Record<string, unknown>[] };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to load users', error);
      throw new HttpError(500, 'Failed to load users');
    }
  }

  public async handlePost(body: unknown): Promise<{ user: Record<string, unknown> }> {
    try {
      const { action } = body as { action?: string };

      if (action === 'register') {
        const { username, password } = body as { username?: string; password?: string };
        console.log('[UsersService] Register attempt:', { username, hasPassword: !!password });
        
        if (!username || !password) {
          throw new HttpError(400, 'Missing credentials');
        }
        const exists = await UserModel.findOne({ display_name: username });
        console.log('[UsersService] Exists check:', { exists: !!exists });
        
        if (exists) {
          throw new HttpError(409, 'Username already exists');
        }

        const userId = crypto.randomUUID();
        console.log('[UsersService] Creating user with ID:', userId);
        
        const newUser = await UserModel.create({
          id: userId,
          display_name: username,
          password: password,
          created_at: new Date().toISOString(),
        });
        
        console.log('[UsersService] User created:', { id: newUser.id, displayName: newUser.display_name });

        return {
          user: {
            id: newUser.id,
            name: newUser.display_name,
            createdAt: newUser.created_at,
          },
        };
      }

      if (action === 'login') {
        const { username, password } = body as { username?: string; password?: string };
        const user = await UserModel.findOne({ display_name: username });
        if (!user || user.password !== password) {
          throw new HttpError(401, 'Invalid credentials');
        }
        return {
          user: {
            id: user.id,
            name: user.display_name,
            createdAt: user.created_at,
          },
        };
      }

      throw new HttpError(400, 'Invalid action');
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('User POST operation failed', error);
      throw new HttpError(500, 'Operation failed');
    }
  }

  public async updateUser(body: unknown): Promise<{ user: Record<string, unknown> }> {
    try {
      const { id, name, avatar } = body as {
        id?: string;
        name?: string;
        avatar?: string;
      };

      if (!id) {
        throw new HttpError(400, 'User ID required');
      }

      const user = await UserModel.findById(id);
      if (!user) {
        throw new HttpError(404, 'User not found');
      }

      const updates: Partial<UserDoc> = {};
      let avatarDisplayUrl: string | undefined;
      
      if (name) updates.display_name = name;
      if (avatar !== undefined) {
        const avatarResult = await this.normalizeAvatar(id, avatar);
        updates.avatar_url = avatarResult.storageKey;
        avatarDisplayUrl = avatarResult.displayUrl;
      }

      await UserModel.updateOne({ id }, updates);

      return {
        user: {
          id: user.id,
          name: updates.display_name || user.display_name,
          avatar: avatarDisplayUrl || await getDisplayUrl(user.avatar_url),
          createdAt: user.created_at,
        },
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Update user failed', error);
      throw new HttpError(500, 'Update failed');
    }
  }
}
