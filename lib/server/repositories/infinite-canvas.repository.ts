import { InfiniteCanvasProjectModel, type InfiniteCanvasProjectDoc } from '../db/models';

export type InfiniteCanvasProjectRecord = InfiniteCanvasProjectDoc;

export class InfiniteCanvasRepository {
  public async countProjects(): Promise<number> {
    return InfiniteCanvasProjectModel.estimatedDocumentCount();
  }

  public async listProjects(): Promise<InfiniteCanvasProjectRecord[]> {
    const records = await InfiniteCanvasProjectModel.find({});
    return [...records].sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.updated_at || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.updated_at || 0).getTime();
      return rightTime - leftTime;
    });
  }

  public async findByProjectId(projectId: string): Promise<InfiniteCanvasProjectRecord | null> {
    return InfiniteCanvasProjectModel.findOne({ project_id: projectId });
  }

  public async claimOwner(projectId: string, ownerId: string): Promise<void> {
    await InfiniteCanvasProjectModel.updateOne(
      { project_id: projectId },
      { $set: { user_id: ownerId } },
      { upsert: false },
    );
  }

  public async upsertOwned(
    projectId: string,
    ownerId: string | null,
    update: Record<string, unknown>,
    options?: { upsert?: boolean },
  ): Promise<void> {
    await InfiniteCanvasProjectModel.updateOne(
      { project_id: projectId },
      { $set: { ...update, project_id: projectId, user_id: ownerId } },
      options,
    );
  }

  public async deleteOwned(projectId: string, ownerId: string): Promise<number> {
    const result = await InfiniteCanvasProjectModel.deleteOne({ project_id: projectId, user_id: ownerId });
    return result.deletedCount ?? 0;
  }

  public async reassignOwner(fromUserId: string, toUserId: string): Promise<void> {
    await InfiniteCanvasProjectModel.updateMany(
      { user_id: fromUserId },
      { user_id: toUserId },
    );
  }

  public async bulkUpsert(operations: Array<{ projectId: string; payload: Record<string, unknown> }>): Promise<void> {
    await InfiniteCanvasProjectModel.bulkWrite(
      operations.map((operation) => ({
        updateOne: {
          filter: { project_id: operation.projectId },
          update: { $set: { ...operation.payload, project_id: operation.projectId } },
          upsert: true,
        },
      })),
    );
  }
}
