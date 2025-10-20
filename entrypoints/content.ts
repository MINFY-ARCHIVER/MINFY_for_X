import type { Media, MinfyItem } from "../types/data";
import { v5 as uuidv5 } from "uuid";

// MINFY用のUUID namespace（固定）
const MINFY_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

// MINFY Itemの雛形を作成
function createMinfyItem(): MinfyItem {
  return {
    extensionVersion: browser.runtime.getManifest().version,
    savedAt: new Date(),
    core: {
      id: "",
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
function getFavoritesCount(likeButton: HTMLButtonElement | null): number {
  if (!likeButton) return 0;
  const ariaLabel = likeButton.getAttribute("aria-label") || "";
  const likeMatch = ariaLabel.match(/(\d+(?:,\d+)*)\s*件のいいね/);
  return likeMatch ? parseInt(likeMatch[1].replace(/,/g, "")) : 0;
}

// メディアを取得
function getMedias(tweetElement: HTMLElement): Media[] {
  const medias: Media[] = [];
  const mediaElements = tweetElement.querySelectorAll<HTMLElement>("[data-testid='tweetPhoto']");
  mediaElements.forEach((mediaElement) => {
    const img = mediaElement.querySelector<HTMLImageElement>("img");
    const video = mediaElement.querySelector<HTMLVideoElement>("video");

    if (img && img.draggable) {
      // 画像の場合
      medias.push({
        rawUrl: img.src.replace(/[?&]name=[^&]+/, "") + "&name=large",
        path: "",
        type: "image",
      });
    } else if (video) {
      // videoがある場合
      if (video.src === "") {
        // srcが空文字列なら動画
        // TODO: 動画をDLできるようにする。
        medias.push({
          rawUrl: video.poster,
          path: "",
          type: "video",
        });
      } else {
        // srcに中身があればGIF
        medias.push({
          rawUrl: video.src,
          path: "",
          type: "gif",
        });
      }
    }
  });
  return medias;
}

// ツイートデータを取得
function createData(tweetElement: HTMLElement) {
  const minfyItem = createMinfyItem();
  const userElement = tweetElement.querySelector<HTMLAnchorElement>("[data-testid^='UserAvatar-Container']");

  minfyItem.core.rawUrl =
    tweetElement.querySelector<HTMLAnchorElement>("a[dir=ltr][role=link]")?.href ??
    tweetElement.querySelector<HTMLAnchorElement>("a[role=link]")?.href?.replace("/photo/1", "") ??
    "";
  minfyItem.core.createdAt = new Date(tweetElement.querySelector<HTMLTimeElement>("time")?.dateTime ?? "");
  minfyItem.core.text = getTweetText(tweetElement.querySelector<HTMLDivElement>("div[lang][data-testid='tweetText']"));
  minfyItem.core.hashtags = Array.from(tweetElement.querySelectorAll<HTMLAnchorElement>("a[href^='/hashtag/']")).map(
    (a) => a.textContent || ""
  );
  minfyItem.core.favoritesCount = getFavoritesCount(tweetElement.querySelector<HTMLButtonElement>("button[data-testid='like']"));
  const authorId =
    userElement?.querySelector<HTMLAnchorElement>("a[href^='/']")?.href.split("/").at(-1) ??
    userElement?.dataset.testid?.replace("UserAvatar-Container-", "") ??
    "";

  minfyItem.core.author = {
    id: authorId,
    name: tweetElement.querySelector<HTMLElement>("[data-testid='User-Name'] div")?.innerText ?? "",
    rawUrl:
      userElement?.querySelector<HTMLAnchorElement>("a[href^='/']")?.href.replace(/\/status\/\d+.*$/, "") ??
      (authorId ? `https://x.com/${authorId}` : ""),
    iconUrl: userElement?.querySelector<HTMLImageElement>("img")?.src ?? "",
    screenName: authorId ? `@${authorId}` : "",
  };
  minfyItem.core.media = getMedias(tweetElement);
  console.log(minfyItem.core.media);

  minfyItem.core.id = uuidv5(minfyItem.core.rawUrl, MINFY_NAMESPACE);
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
        // ツイート要素を作成し、backgroundに送信
        const sendMinfyItem = (element: HTMLElement) => {
          const minfyItem = createData(element);
          console.log(minfyItem.core);
          browser.runtime.sendMessage({ type: "DOWNLOAD_TWEET_ASSETS", payload: minfyItem });
        };

        const quotedElement = tweetElement.querySelector("[tabindex='0']") as HTMLElement | null;
        if (quotedElement) {
          // 引用ツイートの場合、元ツイートと引用ツイートをそれぞれ送信
          const mainTweetClone = tweetElement.cloneNode(true) as HTMLElement;
          mainTweetClone.querySelector("[tabindex='0']")?.remove();
          sendMinfyItem(mainTweetClone);
          sendMinfyItem(quotedElement);
        } else {
          // 通常のツイートの場合、ツイートを送信
          sendMinfyItem(tweetElement);
        }
      }
    });
  },
});
