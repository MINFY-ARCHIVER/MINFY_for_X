const MENU_ID = "raw-save-tweet";

// ダウンロード関連の関数
async function downloadImages(images: string[], author: string, tweetId: string) {
  const basePath = `X_Download/${author}`;
  for (let i = 0; i < images.length; i++) {
    try {
      await browser.downloads.download({
        url: images[i],
        filename: `${basePath}/${tweetId}_${String(i + 1).padStart(2, "0")}.jpg`,
        conflictAction: "uniquify",
        saveAs: false,
      });
    } catch (err) {
      console.error(`[RawSave] Failed:`, images[i], err);
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
      const { author, tweetId, images } = msg.payload;
      if (images) await downloadImages(images, author, tweetId);
    }
  });

  // メニュークリック時にcontent.tsにメッセージを送信
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID && tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: "RAW_SAVE_TRIGGER" });
    }
  });
});
