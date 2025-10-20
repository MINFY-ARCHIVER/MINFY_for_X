import type { Media, MinfyItem } from "../types/data";

const MENU_ID = "minfy-for-x";

// バリデーション関数
function validateMinfyItem(minfyItem: MinfyItem): boolean {
  const { core } = minfyItem;
  if (!core.id || !core.rawUrl || !core.author.id || !core.author.name) {
    return false;
  }
  return true;
}

// 画像ダウンロード関数
async function downloadImages(images: Media[], basePath: string) {
  for (const [index, image] of images.entries()) {
    try {
      await browser.downloads.download({
        url: image.rawUrl,
        filename: `${basePath}/${index}.${image.type === "image" ? "jpg" : image.type === "video" ? "mp4" : "mp3"}`,
        conflictAction: "overwrite",
        saveAs: false,
      });
    } catch (err) {
      console.error(`[RawSave] Failed:`, image.rawUrl, err);
    }
  }
}

// manifest.jsonをダウンロード
async function downloadManifest(minfyItem: MinfyItem, basePath: string) {
  const json = JSON.stringify(minfyItem, null, 2);
  const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  try {
    await browser.downloads.download({
      url: dataUrl,
      filename: `${basePath}/manifest.json`,
      conflictAction: "overwrite",
      saveAs: false,
    });
  } catch (err) {
    console.error(`[RawSave] Failed to save manifest:`, err);
  }
}

// 諸々の処理
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: "ツイートをMINFYで保存",
      contexts: ["all"],
      documentUrlPatterns: ["*://*.x.com/*", "*://*.twitter.com/*"],
      enabled: false,
    });
  });

  // content.tsからのメッセージを受け取る
  browser.runtime.onMessage.addListener(async (msg) => {
    // ツイート上かどうかによってメニューの有効・無効を切り替え
    if (msg.type === "CONTEXT_TWEET_CHECK") {
      browser.contextMenus.update(MENU_ID, { enabled: msg.isTweet });
    }
    // ツイートデータをダウンロード
    if (msg.type === "DOWNLOAD_TWEET_ASSETS") {
      const minfyItem = msg.payload as MinfyItem;
      if (!validateMinfyItem(minfyItem)) return;

      const basePath = `X_Download/${minfyItem.core.author.id}/${minfyItem.core.id}`;
      const { media } = minfyItem.core;
      if (media) await downloadImages(media, basePath);
      await downloadManifest(minfyItem, basePath);
    }
  });

  // メニュークリック時にcontent.tsにメッセージを送信
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID && tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: "RAW_SAVE_TRIGGER" });
    }
  });
});
