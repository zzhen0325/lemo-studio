import type { Page, Route } from "@playwright/test";

import {
  apiConfigResponse,
  datasetCollectionDetails,
  datasetCollectionsResponse,
  googleApiStatusResponse,
  guestSessionResponse,
  infiniteCanvasProjectResponse,
  infiniteCanvasProjectSummaries,
  seededHistoryPage,
  seededViewComfys,
} from "../fixtures/ui-state";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(data),
  });
}

async function fulfillEventStream(route: Route, body = "event: sync\ndata: noop\n\n") {
  await route.fulfill({
    status: 200,
    contentType: "text/event-stream; charset=utf-8",
    headers: {
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
    body,
  });
}

function pathnameFor(route: Route) {
  return new URL(route.request().url()).pathname;
}

function queryFor(route: Route) {
  return new URL(route.request().url()).searchParams;
}

async function delay(ms = 0) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function installCommonUiMocks(page: Page) {
  await page.route("**/api/users**", async (route) => {
    await fulfillJson(route, guestSessionResponse);
  });

  await page.route("**/api/api-config**", async (route) => {
    await fulfillJson(route, apiConfigResponse);
  });

  await page.route("**/api/check-google-api**", async (route) => {
    await fulfillJson(route, googleApiStatusResponse);
  });

  await page.route("**/api/presets/categories**", async (route) => {
    await fulfillJson(route, []);
  });

  await page.route("**/api/presets**", async (route) => {
    if (pathnameFor(route).endsWith("/api/presets/categories")) {
      await route.continue();
      return;
    }
    await fulfillJson(route, []);
  });

  await page.route("**/api/loras**", async (route) => {
    await fulfillJson(route, []);
  });

  await page.route("**/api/styles**", async (route) => {
    await fulfillJson(route, []);
  });

  await page.route("**/api/moodboard-cards**", async (route) => {
    await fulfillJson(route, []);
  });

  await page.route("**/api/tools/presets**", async (route) => {
    await fulfillJson(route, []);
  });
}

export async function installShellUiMocks(page: Page) {
  await installCommonUiMocks(page);
}

export async function installPlaygroundUiMocks(page: Page) {
  await installCommonUiMocks(page);

  await page.route("**/api/history**", async (route) => {
    await fulfillJson(route, seededHistoryPage);
  });

  await page.route("**/api/view-comfy**", async (route) => {
    const pathname = pathnameFor(route);
    const workflowId = pathname.split("/").pop();

    if (pathname.match(/\/api\/view-comfy\/[^/]+$/) && workflowId) {
      const workflow = seededViewComfys.find((item) => item.viewComfyJSON.id === workflowId);
      await fulfillJson(route, workflow ?? seededViewComfys[0]);
      return;
    }

    await fulfillJson(route, { viewComfys: clone(seededViewComfys) });
  });
}

export async function installMappingEditorUiMocks(page: Page) {
  await installCommonUiMocks(page);

  await page.route("**/api/view-comfy**", async (route) => {
    await fulfillJson(route, { viewComfys: clone(seededViewComfys) });
  });
}

export async function installDatasetUiMocks(page: Page) {
  await installCommonUiMocks(page);

  await page.route("**/api/dataset/sync**", async (route) => {
    await fulfillEventStream(route);
  });

  await page.route("**/api/dataset**", async (route) => {
    const request = route.request();
    const collectionName = queryFor(route).get("collection");

    if (request.method() === "GET" && !collectionName) {
      await fulfillJson(route, datasetCollectionsResponse);
      return;
    }

    if (request.method() === "GET" && collectionName) {
      const detail = datasetCollectionDetails[collectionName] ?? { images: [], systemPrompt: "" };
      await fulfillJson(route, clone(detail));
      return;
    }

    if (request.method() === "POST") {
      await fulfillJson(route, { ok: true, ...datasetCollectionsResponse });
      return;
    }

    if (request.method() === "PUT") {
      await fulfillJson(route, { ok: true });
      return;
    }

    if (request.method() === "DELETE") {
      await fulfillJson(route, { ok: true });
      return;
    }

    await route.continue();
  });
}

export async function installToolsUiMocks(page: Page) {
  await installShellUiMocks(page);
}

export async function installSettingsUiMocks(page: Page) {
  await installCommonUiMocks(page);

  await page.route("**/api/view-comfy**", async (route) => {
    await fulfillJson(route, { viewComfys: clone(seededViewComfys) });
  });
}

export async function installInfiniteCanvasRootUiMocks(
  page: Page,
  options?: {
    listDelayMs?: number;
    listStatus?: number;
    listErrorMessage?: string;
  },
) {
  await page.route("**/api/infinite-canvas/projects**", async (route) => {
    const pathname = pathnameFor(route);

    if (pathname !== "/api/infinite-canvas/projects") {
      await route.continue();
      return;
    }

    await delay(options?.listDelayMs ?? 0);

    const status = options?.listStatus ?? 200;
    if (status >= 400) {
      await fulfillJson(route, { error: options?.listErrorMessage ?? "Mock project list failed" }, status);
      return;
    }

    await fulfillJson(route, { projects: clone(infiniteCanvasProjectSummaries) }, status);
  });
}

export async function installInfiniteCanvasEditorUiMocks(page: Page) {
  const handleInfiniteCanvasRoute = async (route: Route) => {
    const pathname = pathnameFor(route);
    const request = route.request();

    if (pathname === "/api/infinite-canvas/projects" && request.method() === "GET") {
      await fulfillJson(route, { projects: clone(infiniteCanvasProjectSummaries) });
      return;
    }

    if (pathname === "/api/infinite-canvas/projects" && request.method() === "POST") {
      await fulfillJson(route, clone(infiniteCanvasProjectResponse));
      return;
    }

    if (pathname === "/api/infinite-canvas/projects/demo-project" && request.method() === "GET") {
      await fulfillJson(route, clone(infiniteCanvasProjectResponse));
      return;
    }

    if (pathname === "/api/infinite-canvas/projects/demo-project" && request.method() === "PUT") {
      await fulfillJson(route, clone(infiniteCanvasProjectResponse));
      return;
    }

    if (pathname === "/api/infinite-canvas/projects/demo-project/duplicate" && request.method() === "POST") {
      await fulfillJson(route, clone(infiniteCanvasProjectResponse));
      return;
    }

    await route.continue();
  };

  await page.route("**/api/infinite-canvas/projects", handleInfiniteCanvasRoute);
  await page.route("**/api/infinite-canvas/projects/**", handleInfiniteCanvasRoute);
}
