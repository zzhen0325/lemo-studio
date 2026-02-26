import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db', () => ({
  ApiProvider: class ApiProviderMock {},
  ApiSettings: class ApiSettingsMock {},
}));

import { ApiConfigService } from '../../server/service/api-config.service';

interface ProviderDoc {
  _id: string;
  id: string;
  name: string;
  providerType?: string;
  apiKey?: string;
  baseURL?: string;
  models?: Record<string, unknown>[];
  isEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

class FakeApiProviderModel {
  public docs: ProviderDoc[] = [];

  public find() {
    return {
      lean: async () => this.docs.map((doc) => ({ ...doc })),
    };
  }

  public async findById(id: string) {
    const doc = this.docs.find((item) => item._id === id || item.id === id);
    return doc ? { ...doc } : null;
  }

  public async updateOne(filter: { _id?: string }, updates: Partial<ProviderDoc>) {
    const id = String(filter._id || '');
    const index = this.docs.findIndex((item) => item._id === id || item.id === id);
    if (index === -1) {
      return { modifiedCount: 0 };
    }
    this.docs[index] = { ...this.docs[index], ...updates };
    return { modifiedCount: 1 };
  }

  public async create(doc: ProviderDoc) {
    this.docs.push({ ...doc });
    return { ...doc };
  }

  public async bulkWrite(
    operations: Array<{ updateOne: { filter: { _id?: string }; update: Partial<ProviderDoc> } }>
  ) {
    for (const operation of operations) {
      await this.updateOne(operation.updateOne.filter, operation.updateOne.update);
    }
    return { modifiedCount: operations.length };
  }

  public async deleteOne(filter: { _id?: string }) {
    const id = String(filter._id || '');
    const before = this.docs.length;
    this.docs = this.docs.filter((item) => item._id !== id && item.id !== id);
    return { deletedCount: before - this.docs.length };
  }
}

class FakeApiSettingsModel {
  public settingsDoc: { key: string; settings: Record<string, unknown> } | null = null;

  public findOne() {
    return {
      lean: async () => this.settingsDoc,
    };
  }

  public async updateOne(
    filter: { key?: string },
    update: { settings: Record<string, unknown> },
  ) {
    this.settingsDoc = {
      key: filter.key || 'default',
      settings: update.settings,
    };
    return { modifiedCount: 1 };
  }
}

const originalEncryptionKey = process.env.API_CONFIG_ENCRYPTION_KEY;

describe('ApiConfigService encryption flow', () => {
  let service: ApiConfigService;
  let providerModel: FakeApiProviderModel;
  let settingsModel: FakeApiSettingsModel;

  beforeAll(() => {
    process.env.API_CONFIG_ENCRYPTION_KEY = 'service-test-encryption-key';
  });

  afterAll(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.API_CONFIG_ENCRYPTION_KEY;
    } else {
      process.env.API_CONFIG_ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  beforeEach(() => {
    providerModel = new FakeApiProviderModel();
    settingsModel = new FakeApiSettingsModel();
    service = new ApiConfigService();
    (service as unknown as { apiProviderModel: FakeApiProviderModel }).apiProviderModel = providerModel;
    (service as unknown as { apiSettingsModel: FakeApiSettingsModel }).apiSettingsModel = settingsModel;
  });

  it('encrypts apiKey when creating a provider', async () => {
    const response = await service.handlePost({
      name: 'Provider A',
      providerType: 'openai-compatible',
      apiKey: 'plain-secret',
      models: [],
      isEnabled: true,
    });

    expect(providerModel.docs).toHaveLength(1);
    expect(providerModel.docs[0].apiKey?.startsWith('enc:v1:')).toBe(true);
    expect(response.providers?.[0].apiKey).toBe('[MASKED:12]');
  });

  it('keeps existing encrypted apiKey when client sends masked value', async () => {
    await service.handlePost({
      name: 'Provider A',
      providerType: 'openai-compatible',
      apiKey: 'first-key',
      models: [],
      isEnabled: true,
    });

    const providerId = providerModel.docs[0].id;
    const encryptedBefore = providerModel.docs[0].apiKey;
    await service.handlePost({
      id: providerId,
      name: 'Provider A updated',
      providerType: 'openai-compatible',
      apiKey: '[MASKED:9]',
      models: [],
      isEnabled: true,
    });

    expect(providerModel.docs[0].apiKey).toBe(encryptedBefore);
  });

  it('migrates legacy plaintext apiKey during getAll', async () => {
    providerModel.docs = [
      {
        _id: 'legacy-1',
        id: 'legacy-1',
        name: 'Legacy Provider',
        providerType: 'openai-compatible',
        apiKey: 'legacy-plain',
        models: [],
        isEnabled: true,
      },
    ];

    const response = await service.getAll();

    expect(providerModel.docs[0].apiKey?.startsWith('enc:v1:')).toBe(true);
    expect(response.providers[0].apiKey).toBe('[MASKED:12]');
  });
});
