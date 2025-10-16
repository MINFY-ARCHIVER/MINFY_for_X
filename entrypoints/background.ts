import type { Author, Media, MinfyItem } from "../types/data";

const MENU_ID = "raw-save-tweet";

// 画像ダウンロード関数
async function downloadImages(images: Media[], author: Author, tweetId: string) {
  const basePath = `X_Download/${author.id}`;
  for (const image of images) {
    try {
      await browser.downloads.download({
        url: image.rawUrl,
        filename: `${basePath}/${tweetId}_${image.type}.${image.type === "image" ? "jpg" : image.type === "video" ? "mp4" : "mp3"}`,
        conflictAction: "uniquify",
        saveAs: false,
      });
    } catch (err) {
      console.error(`[RawSave] Failed:`, image.rawUrl, err);
    }
  }
}

// 諸々の処理
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: "Raw Save Tweet",
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
      const { author, media } = minfyItem.core;
      if (media) await downloadImages(media, author, minfyItem.core.id);
    }
  });

  // メニュークリック時にcontent.tsにメッセージを送信
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID && tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: "RAW_SAVE_TRIGGER" });
    }
  });
});
