import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { User } from '../db';
import { tryNormalizeAssetUrlToCdn } from '../utils/cdn-image-url';

@Injectable()
export class UsersService {
  @Inject(User)
  private userModel!: ModelType<User>;

  private async normalizeAvatar(userId: string, avatar?: string | null): Promise<string | undefined> {
    const normalized = await tryNormalizeAssetUrlToCdn(avatar, {
      preferredSubdir: 'public/avatars',
      preferredFileName: `${userId}.png`,
    });

    if (normalized && normalized !== avatar) {
      await this.userModel.updateOne({ _id: userId }, { $set: { avatar: normalized } });
      return normalized;
    }

    if (!normalized && avatar) {
      await this.userModel.updateOne({ _id: userId }, { $unset: { avatar: 1 } });
    }

    return normalized || undefined;
  }

  public async getUsers(userId?: string | null): Promise<{ user?: Record<string, unknown>; users?: Record<string, unknown>[] }> {
    try {
      if (userId) {
        const user = await this.userModel.findById(userId).lean();
        if (!user) {
          throw new HttpError(404, 'User not found');
        }
        const safeUser = { ...(user as unknown as Record<string, unknown>) };
        delete safeUser.password;
        return {
          user: {
            ...safeUser,
            id: String(user._id),
            avatar: await this.normalizeAvatar(String(user._id), user.avatar),
          } as Record<string, unknown>,
        };
      }

      const users = await this.userModel.find().lean();
      const safeUsers = await Promise.all(users.map(async (u) => {
        const rest = { ...(u as unknown as Record<string, unknown>) };
        delete rest.password;
        return {
          ...rest,
          id: String(u._id),
          avatar: await this.normalizeAvatar(String(u._id), u.avatar),
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
        if (!username || !password) {
          throw new HttpError(400, 'Missing credentials');
        }
        const exists = await this.userModel.findOne({ name: username });
        if (exists) {
          throw new HttpError(409, 'Username already exists');
        }

        const newUser = await this.userModel.create({
          name: username,
          password,
          createdAt: new Date().toISOString(),
        });

        const safeUser = { ...(newUser.toObject() as Record<string, unknown>) };
        delete safeUser.password;
        return { user: { ...safeUser, id: String(newUser._id) } as Record<string, unknown> };
      }

      if (action === 'login') {
        const { username, password } = body as { username?: string; password?: string };
        const user = await this.userModel.findOne({ name: username, password }).lean();
        if (!user) {
          throw new HttpError(401, 'Invalid credentials');
        }
        const safeUser = { ...(user as unknown as Record<string, unknown>) };
        delete safeUser.password;
        return { user: { ...safeUser, id: String(user._id) } as Record<string, unknown> };
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
      const { id, name, avatar, password } = body as {
        id?: string;
        name?: string;
        avatar?: string;
        password?: string;
      };

      if (!id) {
        throw new HttpError(400, 'User ID required');
      }

      const user = await this.userModel.findById(id);
      if (!user) {
        throw new HttpError(404, 'User not found');
      }

      if (name) user.name = name;
      if (avatar !== undefined) {
        user.avatar = await this.normalizeAvatar(String(user._id), avatar);
      }
      if (password) user.password = password;

      await user.save();
      const safeUser = { ...(user.toObject() as Record<string, unknown>) };
      delete safeUser.password;
      return { user: { ...safeUser, id: String(user._id) } as Record<string, unknown> };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Update user failed', error);
      throw new HttpError(500, 'Update failed');
    }
  }
}
