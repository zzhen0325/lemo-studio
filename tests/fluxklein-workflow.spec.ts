import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildFluxKleinWorkflow } from '@/lib/api/fluxklein-workflow';

vi.mock('@/lib/runtime-assets', () => ({
  readJsonAsset: async (relativePath: string) => {
    const absolutePath = path.join(process.cwd(), relativePath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    return JSON.parse(content);
  },
}));

type WorkflowNode = {
  class_type?: string;
  inputs?: Record<string, unknown>;
};

type Workflow = Record<string, WorkflowNode>;

function findNodeByClassType(workflow: Workflow, classType: string): WorkflowNode | undefined {
  return Object.values(workflow).find((node) => node?.class_type === classType);
}

describe('buildFluxKleinWorkflow', () => {
  it('uses the requested width and height without reference images', async () => {
    const { workflow } = await buildFluxKleinWorkflow({
      prompt: 'test prompt',
      width: 1216,
      height: 832,
    });

    const schedulerNode = findNodeByClassType(workflow, 'Flux2Scheduler');
    const latentNode = findNodeByClassType(workflow, 'EmptyFlux2LatentImage');

    expect(schedulerNode?.inputs?.width).toBe(1216);
    expect(schedulerNode?.inputs?.height).toBe(832);
    expect(latentNode?.inputs?.width).toBe(1216);
    expect(latentNode?.inputs?.height).toBe(832);
    expect(findNodeByClassType(workflow, 'GetImageSize')).toBeUndefined();
  });

  it('still uses the requested width and height with reference images', async () => {
    const { workflow, viewComfyInputs } = await buildFluxKleinWorkflow({
      prompt: 'test prompt',
      width: 1536,
      height: 1024,
      referenceImages: ['input/ref-1.png'],
    });

    const schedulerNode = findNodeByClassType(workflow, 'Flux2Scheduler');
    const latentNode = findNodeByClassType(workflow, 'EmptyFlux2LatentImage');

    expect(schedulerNode?.inputs?.width).toBe(1536);
    expect(schedulerNode?.inputs?.height).toBe(1024);
    expect(latentNode?.inputs?.width).toBe(1536);
    expect(latentNode?.inputs?.height).toBe(1024);
    expect(findNodeByClassType(workflow, 'GetImageSize')).toBeUndefined();
    expect(viewComfyInputs).toEqual([{ key: expect.stringMatching(/-inputs-image$/), value: 'input/ref-1.png' }]);
  });
});
