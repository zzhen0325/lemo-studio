import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { User } from '../db';

@Injectable()
export class UsersService {
  @Inject(User)
  private userModel!: ModelType<User>;

  public async getUsers(userId?: string | null): Promise<{ user?: any; users?: any[] }> {
    try {
      if (userId) {
        const user = await this.userModel.findById(userId).lean();
        if (!user) {
          throw new HttpError(404, 'User not found');
        }
        const { password, ...safeUser } = user as any;
        return { user: { ...safeUser, id: String(user._id) } };
      }

      const users = await this.userModel.find().lean();
      const safeUsers = users.map((u) => {
        const { password, ...rest } = u as any;
        return { ...rest, id: String(u._id) };
      });
      return { users: safeUsers };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to load users', error);
      throw new HttpError(500, 'Failed to load users');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async handlePost(body: any): Promise<{ user: any }> {
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
          avatar: `/avatars/${Math.floor(Math.random() * 5) + 1}.png`,
          createdAt: new Date().toISOString(),
        });

        const { password: _, ...safeUser } = newUser.toObject();
        return { user: { ...safeUser, id: String(newUser._id) } };
      }

      if (action === 'login') {
        const { username, password } = body as { username?: string; password?: string };
        const user = await this.userModel.findOne({ name: username, password }).lean();
        if (!user) {
          throw new HttpError(401, 'Invalid credentials');
        }
        const { password: _, ...safeUser } = user as any;
        return { user: { ...safeUser, id: String(user._id) } };
      }

      throw new HttpError(400, 'Invalid action');
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('User POST operation failed', error);
      throw new HttpError(500, 'Operation failed');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async updateUser(body: any): Promise<{ user: any }> {
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
      if (avatar) user.avatar = avatar;
      if (password) user.password = password;

      await user.save();
      const { password: _, ...safeUser } = user.toObject();
      return { user: { ...safeUser, id: String(user._id) } };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Update user failed', error);
      throw new HttpError(500, 'Update failed');
    }
  }
}
