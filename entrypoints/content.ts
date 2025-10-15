// ツイートデータを取得
function getTweetData(tweetElement: HTMLElement) {
  const images = Array.from(tweetElement.querySelectorAll<HTMLImageElement>("[data-testid='tweetPhoto'] img")).map((img) =>
    img.src.replace(/[?&]name=[^&]+/, "")
  );

  // 画像要素から祖先のa[role=link]を取得してURLからauthor/tweetIdを抽出
  // 安定するかは未確認だが、引用ツイートの場合は引用元のツイートIDが取得できるので、それを使う
  const firstImg = tweetElement.querySelector<HTMLImageElement>("[data-testid='tweetPhoto'] img");
  const link = firstImg?.closest<HTMLAnchorElement>("a[role=link]")?.href.split("/");

  return {
    author: link?.at(-5) ?? null,
    tweetId: link?.at(-3) ?? null,
    images: images.length ? images : null,
  };
}

export default defineContentScript({
  matches: ["*://x.com/*", "*://*.twitter.com/*"],
  main() {
    let tweetElement: HTMLElement | null = null;

    // ツイート要素を取得
    document.addEventListener(
      "contextmenu",
      (e) => {
        const clickedElement = e.target as HTMLElement;
        tweetElement =
          (clickedElement.closest("article[data-testid=tweet]") as HTMLElement) ??
          (clickedElement.closest("article[role='article']") as HTMLElement);
        const isOnTweet = tweetElement !== null;

        // backgroundに「ツイート上かどうか」を通知
        browser.runtime.sendMessage({
          type: "CONTEXT_TWEET_CHECK",
          isTweet: isOnTweet,
        });
      },
      { capture: true }
    );

    // メニュークリック時に受け取るメッセージ
    browser.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "RAW_SAVE_TRIGGER" && tweetElement) {
        // backgroundにツイートデータを送信
        browser.runtime.sendMessage({
          type: "DOWNLOAD_TWEET_ASSETS",
          payload: getTweetData(tweetElement),
        });
      }
    });
  },
});
