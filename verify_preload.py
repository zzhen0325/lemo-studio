import asyncio
from playwright.async_api import async_playwright
import json

async def verify_preload():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # 用于记录请求
        requests = []
        page.on("request", lambda request: requests.append(request.url))

        print("正在定位到 Playground 页面...")
        try:
            # 假设服务器已在 3325 端口运行 (基于常见前端项目配置)
            # 如果不确定，通常 npm run dev 会显示
            await page.goto('http://localhost:3325/playground')
            
            # 等待网络空闲，确保初始请求已发出
            await page.wait_for_load_state('networkidle')
            
            print("\n检查网络请求...")
            # 检查是否包含 fetchHistory 和 fetchGallery 的请求
            # fetchHistory 请求通常包含 userId 或 projectId
            # fetchGallery 请求通常不含 userId
            history_calls = [r for r in requests if "/history" in r]
            
            print(f"找到 {len(history_calls)} 个 /history 请求:")
            for call in history_calls:
                print(f"  - {call}")

            # 验证逻辑：
            # 1. 应该至少有两个请求（或者一个请求被触发两次，取决于 store 逻辑，但 fetchHistory 和 fetchGallery 都是调用的 /history）
            # 2. 检查参数差异
            
            if len(history_calls) >= 2:
                print("\n✅ 验证成功：监测到多个预加载请求。")
            elif len(history_calls) == 1:
                # 有可能请求被合并或只触发了一个，需要进一步检查
                print("\n⚠️ 警告：仅监测到一个请求，请检查代码逻辑是否导致合并或失效。")
            else:
                print("\n❌ 验证失败：未监测到预加载请求。")

            # 截图留证
            await page.screenshot(path='/Users/bytedance/.gemini/antigravity/brain/3dc31b35-b3f4-438a-be5e-a64281d4fce4/verify_preload.png', full_page=True)
            print(f"\n截图已保存至 artifacts 目录。")

        except Exception as e:
            print(f"发生错误: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_preload())
