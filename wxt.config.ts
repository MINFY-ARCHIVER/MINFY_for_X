import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  manifest: {
    permissions: ["contextMenus", "scripting", "downloads"],
    host_permissions: [
      "*://*.x.com/*",
      "*://*.twitter.com/*",
      "*://*.twimg.com/*", // 画像ダウンロード用
    ],
  },
});
