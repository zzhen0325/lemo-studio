import { expect, test, type Page } from "@playwright/test";

import {
  installCommonUiMocks,
  installDatasetUiMocks,
  installInfiniteCanvasEditorUiMocks,
  installInfiniteCanvasRootUiMocks,
  installMappingEditorUiMocks,
  installPlaygroundUiMocks,
  installSettingsUiMocks,
  installToolsUiMocks,
} from "./helpers/ui-mocks";
import { buildSeededHistoryPage } from "./fixtures/ui-state";

const PLAYGROUND_ROUTE = "/studio/playground";

async function gotoStudioShell(page: Page, route = PLAYGROUND_ROUTE) {
  await page.goto(route);
  await expect(page.locator("header")).toBeVisible();
  await expect(page.getByAltText("Lemo Studio")).toBeVisible();
}

async function installDenseGalleryUiMocks(page: Page, total = 96) {
  await installCommonUiMocks(page);
  await page.route("**/api/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(buildSeededHistoryPage(total)),
    });
  });
}

test.describe("Studio shell interactions", () => {
  test("top navigation reaches stable studio surfaces", async ({ page }) => {
    await gotoStudioShell(page);
    const shellHeader = page.locator("header").first();

    await shellHeader.getByRole("button", { name: "Tools", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/tools$/);
    await expect(page.getByText("WebGL Tools Studio")).toBeVisible();

    await shellHeader.getByRole("button", { name: "Dataset", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/dataset$/);
    await expect(page.getByRole("heading", { name: "Datasets" })).toBeVisible();

    await shellHeader.getByRole("button", { name: "Playground", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/playground$/);
  });

  test("sign in dialog opens, switches tabs, and closes", async ({ page }) => {
    await gotoStudioShell(page);

    await page.getByRole("button", { name: "Sign In" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "LEMO STUDIO" })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Login" })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Register" })).toBeVisible();

    await dialog.getByRole("tab", { name: "Register" }).click();
    await expect(dialog.getByRole("button", { name: "Create Account" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("Frontend visibility and interaction coverage", () => {
  test("playground dock panels switch cleanly with UI-only mocks", async ({ page }) => {
    await installPlaygroundUiMocks(page);
    await gotoStudioShell(page);

    await page.getByRole("button", { name: "Gallery", exact: true }).click();
    await expect(page.getByPlaceholder("Search gallery prompts...")).toBeVisible();
    await expect(page.getByRole("button", { name: /Filters/i })).toBeVisible();

    await page.getByRole("button", { name: "Moodboards", exact: true }).click();
    await expect(page.getByPlaceholder("搜索情绪板或提示词...")).toBeVisible();
    await expect(page.getByRole("button", { name: "New Moodboard" })).toBeVisible();

    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByTitle("Grid View")).toBeVisible();
    await expect(page.getByTitle("List View")).toBeVisible();
    await expect(page.getByText("Editorial portrait in warm sunset light")).toBeVisible();

    await page.getByRole("button", { name: "Describe", exact: true }).click();
    await expect(page.getByText("拖动图片到此处 或 点击选择图片")).toBeVisible();
    await expect(page.getByPlaceholder("Search gallery prompts...")).toHaveCount(0);
  });

  test("legacy standalone gallery route redirects to playground", async ({ page }) => {
    await installPlaygroundUiMocks(page);
    await page.goto("/studio/gallery");

    await expect(page).toHaveURL(/\/studio\/playground$/);
    await expect(page.locator("header")).toBeVisible();
  });

  test("playground dock gallery keeps the shared internal scroll viewport", async ({ page }) => {
    await installDenseGalleryUiMocks(page);
    await gotoStudioShell(page);

    await page.getByRole("button", { name: "Gallery", exact: true }).click();
    await expect(page.getByPlaceholder("Search gallery prompts...")).toBeVisible();

    const scrollContainer = page.getByTestId("gallery-scroll-container");
    await expect(scrollContainer).toBeVisible();

    await expect.poll(async () => {
      return scrollContainer.getAttribute("data-gallery-viewport-ready");
    }).toBe("true");

    await expect.poll(async () => {
      return scrollContainer.evaluate((element) => element.scrollHeight > element.clientHeight);
    }).toBe(true);

    const initialMetrics = await scrollContainer.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));

    expect(initialMetrics.scrollHeight).toBeGreaterThan(initialMetrics.clientHeight);

    await scrollContainer.evaluate((element) => {
      element.scrollTo({ top: 2200 });
      element.dispatchEvent(new Event("scroll"));
    });

    await expect.poll(async () => {
      return scrollContainer.evaluate((element) => element.scrollTop);
    }).toBeGreaterThan(0);

    await expect(page.locator('[data-gallery-item-key="history-048"]')).toBeVisible();
  });

  test("mapping editor keeps library, search, and delete dialog visible", async ({ page }) => {
    await installMappingEditorUiMocks(page);
    await page.goto("/studio/mapping-editor");

    await expect(page.getByRole("heading", { name: /Mapping/i })).toBeVisible();
    await expect(page.getByText("ADD WORKFLOW")).toBeVisible();
    await expect(page.getByText("Seed Workflow")).toBeVisible();
    await expect(page.getByText("Banner Flow")).toBeVisible();

    await page.getByPlaceholder("搜索库中的工作流...").fill("seed");
    await expect(page.getByText("Seed Workflow")).toBeVisible();
    await expect(page.getByText("Banner Flow")).toHaveCount(0);

    await page.getByText("Seed Workflow").click();
    await expect(page.getByRole("button", { name: "Upload Cover" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "删除" })).toBeVisible();
    await expect(page.getByText("Workflow Nodes")).toBeVisible();

    await page.getByRole("button", { name: "删除" }).dispatchEvent("click");
    await expect(page.getByText("确认删除工作流？")).toBeVisible();
    await expect(page.getByRole("button", { name: "取消" })).toBeVisible();
    await expect(page.getByRole("button", { name: "确认删除" })).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByText("确认删除工作流？")).toHaveCount(0);
  });

  test("dataset list and detail surfaces render visible UI affordances", async ({ page }) => {
    await installDatasetUiMocks(page);
    await page.goto("/studio/dataset");

    await expect(page.getByRole("heading", { name: "Datasets" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create New Collection" })).toBeVisible();
    await expect(page.getByText("Brand Shots")).toBeVisible();

    await page.getByText("Brand Shots").click();
    await expect(page.getByRole("heading", { name: "Brand Shots" })).toBeVisible();
    await expect(page.getByText("2 images with prompts")).toBeVisible();

    await page.locator("button:has(svg.lucide-chevron-left)").first().click();
    await expect(page.getByRole("heading", { name: "Datasets" })).toBeVisible();
    await expect(page.getByText("Brand Shots")).toBeVisible();

    await page.locator("#dataset-scroll-container").locator('button[aria-haspopup="menu"]').first().click();
    await expect(page.getByText("Export")).toBeVisible();
    await expect(page.getByText("Copy")).toBeVisible();
    await expect(page.getByText("Delete")).toBeVisible();
  });

  test("tools page opens a tool detail view with capture controls", async ({ page }) => {
    await installToolsUiMocks(page);
    await page.goto("/studio/tools");

    await expect(page.getByText("WebGL Tools Studio")).toBeVisible();

    await page.getByText("Deep Sea Flow").click();
    await expect(page.getByRole("button", { name: "Capture PNG" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Record Video" })).toBeVisible();
    await expect(page.locator("button:has(svg.lucide-arrow-left)")).toBeVisible();
  });

  test("settings keeps Settings and Workflow Mapper shells visible", async ({ page }) => {
    await installSettingsUiMocks(page);
    await page.goto("/studio/settings");

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Settings" })).toBeVisible();

    await page.getByRole("button", { name: "Workflow Mapper" }).click();
    await expect(page.getByRole("heading", { name: /Mapping/i })).toBeVisible();
    await expect(page.getByPlaceholder("搜索库中的工作流...")).toBeVisible();
  });

  test("infinite canvas entry route shows loading state while project lookup is pending", async ({ page }) => {
    await installInfiniteCanvasRootUiMocks(page, { listDelayMs: 2_000 });
    await page.goto("/infinite-canvas");

    await expect(page.getByText("正在进入画布...")).toBeVisible();
  });

  test("infinite canvas entry route shows retry UI on load failure", async ({ page }) => {
    await installInfiniteCanvasRootUiMocks(page, {
      listStatus: 500,
      listErrorMessage: "Mock project list failed",
    });
    await page.goto("/infinite-canvas");

    await expect(page.getByText("Mock project list failed")).toBeVisible();
    await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
  });

  test("infinite canvas editor loads a mocked project and exposes core controls", async ({ page }) => {
    await installInfiniteCanvasEditorUiMocks(page);
    await page.goto("/infinite-canvas/editor/demo-project");

    await expect(page).toHaveURL(/\/infinite-canvas\/editor\/demo-project$/);
    await expect(page.getByTitle("创建 Text 节点")).toBeVisible();
    await expect(page.getByTitle("创建 Image 节点")).toBeVisible();
    await expect(page.getByTitle("创建 Gallery 多图节点")).toBeVisible();
    await expect(page.getByText("自动保存已启用")).toBeVisible();

    await page.getByTitle("资产面板").click();
    await expect(page.getByText("Assets")).toBeVisible();

    await page.getByTitle("创建 Text 节点").click();
    await expect(page.getByText("Text Block")).toBeVisible();
  });
});
