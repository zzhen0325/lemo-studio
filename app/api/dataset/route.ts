import { NextRequest } from 'next/server';
import {
  DatasetDeleteSchema,
  DatasetPostSchema,
  DatasetQuerySchema,
  DatasetUpdateSchema,
} from '@/lib/schemas/dataset';
import { getServerServices } from '@/lib/server/container';
import {
  fileValue,
  fileValues,
  formValueAsString,
  handleRoute,
  queryRecord,
  readJsonBody,
} from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function parsePromptMap(raw: FormDataEntryValue | null): Record<string, string> | undefined {
  if (typeof raw !== 'string' || !raw.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
      }
      return acc;
    }, {});
  } catch {
    throw new HttpError(400, 'Invalid promptMap');
  }
}

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { datasetService } = await getServerServices();
    const query = queryRecord(request.nextUrl.searchParams);
    const parsed = DatasetQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid query', parsed.error.flatten());
    }
    return datasetService.getDataset(parsed.data);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { datasetService } = await getServerServices();
    const formData = await request.formData();
    const parsed = DatasetPostSchema.safeParse({
      collection: formValueAsString(formData.get('collection')),
      mode: formValueAsString(formData.get('mode')),
      newName: formValueAsString(formData.get('newName')),
    });
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid payload', parsed.error.flatten());
    }

    const file = fileValue(formData.get('file'));
    const files = fileValues(formData, 'files');

    return datasetService.postDataset({
      file: file
        ? {
            name: file.name,
            arrayBuffer: () => file.arrayBuffer(),
          }
        : null,
      files: files.map((item) => ({
        name: item.name,
        arrayBuffer: () => item.arrayBuffer(),
      })),
      collection: parsed.data.collection,
      mode: parsed.data.mode,
      newName: parsed.data.newName ?? undefined,
      promptMap: parsePromptMap(formData.get('promptMap')),
    });
  });
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const { datasetService } = await getServerServices();
    const params = queryRecord(request.nextUrl.searchParams);
    const parsed = DatasetDeleteSchema.safeParse(params);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid query', parsed.error.flatten());
    }
    return datasetService.deleteDataset(parsed.data);
  });
}

export async function PUT(request: Request) {
  return handleRoute(async () => {
    const { datasetService } = await getServerServices();
    const body = await readJsonBody(request);
    const parsed = DatasetUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid payload', parsed.error.flatten());
    }
    return datasetService.updateDataset(parsed.data);
  });
}
