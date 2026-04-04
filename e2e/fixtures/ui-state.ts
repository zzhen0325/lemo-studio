export const TEST_IMAGE_URL = "/images/c.png";
export const TEST_TIMESTAMP = "2026-04-04T08:00:00.000Z";

export const guestSessionResponse = {
  session: {
    actorId: "guest-ui-tester",
    isGuest: true,
    user: null,
  },
};

export const apiConfigResponse = {
  providers: [],
  settings: {},
};

export const googleApiStatusResponse = {
  status: "connected",
};

export const seededHistoryPage = {
  history: [
    {
      id: "history-001",
      userId: "guest-ui-tester",
      projectId: "project-ui",
      outputUrl: TEST_IMAGE_URL,
      config: {
        prompt: "Editorial portrait in warm sunset light",
        width: 1024,
        height: 1280,
        model: "seedream-3.0",
        sourceImageUrls: [TEST_IMAGE_URL],
      },
      status: "completed",
      createdAt: TEST_TIMESTAMP,
    },
    {
      id: "history-002",
      userId: "guest-ui-tester",
      projectId: "project-ui",
      outputUrl: TEST_IMAGE_URL,
      config: {
        prompt: "Minimal product packshot with dramatic shadow",
        width: 1024,
        height: 1024,
        model: "seedream-3.0",
      },
      status: "completed",
      createdAt: "2026-04-04T08:05:00.000Z",
    },
  ],
  hasMore: false,
  total: 2,
};

export const seededViewComfys = [
  {
    viewComfyJSON: {
      id: "seed-workflow",
      title: "Seed Workflow",
      description: "Seeded workflow for UI-only interaction checks.",
      previewImages: [],
      inputs: [],
      advancedInputs: [],
      mappingConfig: {
        components: [],
      },
    },
    workflowApiJSON: {
      "1": {
        class_type: "KSampler",
        inputs: {
          seed: 123456,
          steps: 20,
          cfg: 7,
        },
      },
      "2": {
        class_type: "CheckpointLoaderSimple",
        inputs: {
          ckpt_name: "seed-model.safetensors",
        },
      },
    },
  },
  {
    viewComfyJSON: {
      id: "banner-flow",
      title: "Banner Flow",
      description: "Banner workflow card used for search filtering coverage.",
      previewImages: [],
      inputs: [],
      advancedInputs: [],
      mappingConfig: {
        components: [],
      },
    },
    workflowApiJSON: {
      "10": {
        class_type: "KSampler",
        inputs: {
          seed: 98765,
          steps: 28,
          cfg: 6,
        },
      },
      "11": {
        class_type: "CheckpointLoaderSimple",
        inputs: {
          ckpt_name: "banner-model.safetensors",
        },
      },
    },
  },
];

export const datasetCollectionsResponse = {
  collections: [
    {
      id: "brand-shots",
      name: "Brand Shots",
      imageCount: 2,
      previews: [TEST_IMAGE_URL, TEST_IMAGE_URL, TEST_IMAGE_URL, TEST_IMAGE_URL],
    },
    {
      id: "campaign-refs",
      name: "Campaign Refs",
      imageCount: 1,
      previews: [TEST_IMAGE_URL, TEST_IMAGE_URL, "", ""],
    },
  ],
};

export const datasetCollectionDetails: Record<
  string,
  {
    images: Array<{
      id: string;
      url: string;
      prompt: string;
      promptZh?: string;
      promptEn?: string;
      filename: string;
      width?: number;
      height?: number;
    }>;
    systemPrompt: string;
  }
> = {
  "Brand Shots": {
    images: [
      {
        id: "brand-1",
        url: TEST_IMAGE_URL,
        prompt: "Studio fashion portrait with clean background",
        promptZh: "纯色背景时尚棚拍人像",
        filename: "brand-shot-1.png",
        width: 1024,
        height: 1280,
      },
      {
        id: "brand-2",
        url: TEST_IMAGE_URL,
        prompt: "Close-up beauty shot with glossy highlights",
        promptZh: "高光质感美妆特写",
        filename: "brand-shot-2.png",
        width: 1024,
        height: 1280,
      },
    ],
    systemPrompt: "",
  },
  "Campaign Refs": {
    images: [
      {
        id: "campaign-1",
        url: TEST_IMAGE_URL,
        prompt: "Wide campaign reference board",
        filename: "campaign-ref-1.png",
        width: 1280,
        height: 1024,
      },
    ],
    systemPrompt: "",
  },
};

export const infiniteCanvasProjectSummaries = [
  {
    projectId: "demo-project",
    projectName: "Demo Project",
    updatedAt: TEST_TIMESTAMP,
    createdAt: TEST_TIMESTAMP,
    nodeCount: 2,
    lastOutputPreview: TEST_IMAGE_URL,
  },
];

export const infiniteCanvasProjectResponse = {
  project: {
    projectId: "demo-project",
    projectName: "Demo Project",
    updatedAt: TEST_TIMESTAMP,
    createdAt: TEST_TIMESTAMP,
    nodeCount: 2,
    canvasViewport: {
      x: 180,
      y: 120,
      scale: 1,
    },
    lastOpenedPanel: null,
    nodes: [
      {
        nodeId: "node-text-1",
        nodeType: "text",
        title: "Project Brief",
        position: { x: 80, y: 120 },
        width: 320,
        height: 220,
        status: "idle",
        prompt: "Summarize the visual direction for a premium campaign.",
        outputs: [
          {
            outputId: "text-output-1",
            outputType: "text",
            textContent: "Premium visual direction",
            createdAt: TEST_TIMESTAMP,
          },
        ],
        isLocked: false,
        isSelected: false,
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP,
      },
      {
        nodeId: "node-image-1",
        nodeType: "image",
        title: "Hero Render",
        position: { x: 480, y: 100 },
        width: 360,
        height: 300,
        status: "ready",
        modelId: "seedream-3.0",
        prompt: "Editorial portrait with refined studio lighting",
        params: {
          aspectRatio: "4:5",
          imageSize: "1K",
          seed: 246810,
          batchSize: 1,
        },
        outputs: [
          {
            outputId: "image-output-1",
            outputType: "image",
            assetUrl: TEST_IMAGE_URL,
            thumbnailUrl: TEST_IMAGE_URL,
            promptSnapshot: "Editorial portrait with refined studio lighting",
            createdAt: TEST_TIMESTAMP,
          },
        ],
        isLocked: false,
        isSelected: false,
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP,
      },
    ],
    edges: [],
    assets: [
      {
        assetId: "asset-1",
        name: "Reference 01",
        url: TEST_IMAGE_URL,
        thumbnailUrl: TEST_IMAGE_URL,
        createdAt: TEST_TIMESTAMP,
      },
    ],
    history: [
      {
        historyId: "history-item-1",
        nodeId: "node-image-1",
        outputType: "image",
        outputUrl: TEST_IMAGE_URL,
        promptSnapshot: "Editorial portrait with refined studio lighting",
        createdAt: TEST_TIMESTAMP,
        status: "success",
      },
    ],
    runQueue: [
      {
        queueId: "queue-1",
        nodeId: "node-image-1",
        nodeTitle: "Hero Render",
        status: "running",
        progress: 0.48,
        etaSeconds: 18,
        startedAt: TEST_TIMESTAMP,
      },
    ],
  },
};
