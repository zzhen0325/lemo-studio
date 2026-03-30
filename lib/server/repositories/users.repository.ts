import { UserModel, type UserDoc } from '../db/models';

export type UserRecord = UserDoc;

export class UsersRepository {
  public async findById(id: string): Promise<UserRecord | null> {
    return UserModel.findById(id);
  }

  public async findByDisplayName(displayName: string): Promise<UserRecord | null> {
    return UserModel.findOne({ display_name: displayName });
  }

  public async create(doc: Partial<UserRecord>): Promise<UserRecord> {
    return UserModel.create(doc);
  }

  public async updateProfile(id: string, update: Partial<UserRecord>): Promise<void> {
    await UserModel.updateOne({ id }, update);
  }
}
