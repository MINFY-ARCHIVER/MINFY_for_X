import type { MinfyItem } from "../types/data";

// MINFY Itemの雛形を作成
function createMinfyItem(): MinfyItem {
  return {
    extensionVersion: browser.runtime.getManifest().version,
    savedAt: new Date(),
    core: {
      id: crypto.randomUUID(),
      source: "x",
      rawUrl: "",
      createdAt: new Date(),
      text: null,
      hashtags: [],
      favoritesCount: 0,
      author: {
        id: "",
        name: "",
        rawUrl: "",
        iconUrl: "",
        screenName: "",
      },
      media: [],
      bookmarked: false,
    },
  };
}

// ツイート本文を取得
// aやspan要素で構成されているため、構造を保持してURLをt.coに置き換える
// 絵文字はimg要素のalt属性から取得
function getTweetText(tweetTextElement: HTMLDivElement | null) {
  if (tweetTextElement === null) return null;

  const result: string[] = [];

  Array.from(tweetTextElement.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // テキストノードはそのまま追加
      result.push(node.textContent || "");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;

      if (element.tagName === "SPAN") {
        // span要素のテキストを取得
        result.push(element.textContent || "");
      } else if (element.tagName === "A") {
        // a要素のhref（t.coのURL）を取得
        const linkElement = element as HTMLAnchorElement;
        result.push(linkElement.href);
      } else if (element.tagName === "IMG") {
        // img要素のalt属性から絵文字を取得
        const imgElement = element as HTMLImageElement;
        result.push(imgElement.alt || "");
      }
    }
  });

  return result.join("");
}

// いいね数を取得
function getFavoritesCount(likeButton: HTMLButtonElement): number {
  const ariaLabel = likeButton.getAttribute("aria-label") || "";
  const likeMatch = ariaLabel.match(/(\d+(?:,\d+)*)\s*件のいいね/);
  return likeMatch ? parseInt(likeMatch[1].replace(/,/g, "")) : 0;
}

// ツイートデータを取得
function createData(tweetElement: HTMLElement) {
  const minfyItem = createMinfyItem();
  const userElement = tweetElement.querySelector<HTMLAnchorElement>("[data-testid^='UserAvatar-Container']") ?? new HTMLAnchorElement();

  minfyItem.core.rawUrl = tweetElement.querySelector<HTMLAnchorElement>("a[dir=ltr][role=link]")?.href ?? "";
  minfyItem.core.createdAt = new Date(tweetElement.querySelector<HTMLTimeElement>("time")?.dateTime ?? "");
  minfyItem.core.text = getTweetText(tweetElement.querySelector<HTMLDivElement>("div[lang][data-testid='tweetText']"));
  minfyItem.core.hashtags = Array.from(tweetElement.querySelectorAll<HTMLAnchorElement>("a[href^='/hashtag/']")).map(
    (a) => a.textContent || ""
  );
  minfyItem.core.favoritesCount = getFavoritesCount(
    tweetElement.querySelector<HTMLButtonElement>("button[data-testid='like']") ?? new HTMLButtonElement()
  );
  minfyItem.core.author = {
    id: userElement.querySelector<HTMLAnchorElement>("a[href^='/']")?.href.split("/").at(-1) ?? "",
    name: tweetElement.querySelector<HTMLElement>("[data-testid='User-Name'] a")?.innerText ?? "",
    rawUrl: tweetElement.querySelector<HTMLAnchorElement>("a[href^='/']")?.href ?? "",
    iconUrl: userElement.querySelector<HTMLImageElement>("img")?.src ?? "",
    screenName: (() => {
      const screenNameValue = userElement.querySelector<HTMLAnchorElement>("a[href^='/']")?.href.split("/").at(-1) ?? "";
      return screenNameValue ? `@${screenNameValue}` : "";
    })(),
  };
  minfyItem.core.media = Array.from(tweetElement.querySelectorAll<HTMLImageElement>("[data-testid='tweetPhoto'] img")).map((img) => ({
    rawUrl: img.src.replace(/[?&]name=[^&]+/, ""),
    // MEMO: ローカル保存パスはここで決定する
    // いいファイル構造が思いつけば、それを使う
    path: img.src.replace(/[?&]name=[^&]+/, ""),
    type: "image",
  }));

  return minfyItem;
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
        // minfyItemを作成
        const minfyItem = createData(tweetElement);
        console.log(minfyItem.core);
        // backgroundにminfyItemを送信
        browser.runtime.sendMessage({
          type: "DOWNLOAD_TWEET_ASSETS",
          payload: minfyItem,
        });
      }
    });
  },
});
