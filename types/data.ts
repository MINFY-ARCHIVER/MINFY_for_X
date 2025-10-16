/*
 * MINFYは、複数のプラットフォーム（X/Twitter・Pixiv・Booth等）から
 * 取得した投稿データを統一的に扱うためのデータ構造を定義する。
 *
 * - MinfyItem: MINFY Viewerで保存される1投稿単位のデータ構造。
 *
 * manifest.json 全体の構造は以下の通り：
 * {
 *   "extensionVersion": "0.3.0",
 *   "savedAt": "2025-10-16T04:00:00+09:00",
 *   "core": { ... },
 *   "meta": { ... },
 * }
 */

/*
 * MINFY Viewerで保存される1投稿単位のデータ構造
 */
export interface MinfyItem {
  // 拡張機能のバージョン
  extensionVersion: string;

  // 保存日時
  savedAt: Date;

  // 必須データ
  core: Data;

  // プラットフォームごとの固有データ（あれば使う）
  meta?: PlatformMeta;
}

/* ==========================================================================//
/*                               Common Data                                 //
/* ==========================================================================//


/*
 * 投稿の共通データ
 * このデータは存在する前提として、ビューワーで最低限の表示・検索が可能
 */
export interface Data {
  // MINFY内部で付与される一意のUUID
  id: string;

  // データ取得元のプラットフォーム識別子
  source: "x" | "other";

  // 元投稿のURL（例: https://x.com/...）
  rawUrl: string;

  // 投稿日時（ISO8601）
  createdAt: Date;

  // 本文
  text: string;

  // ハッシュタグ配列
  hashtags: string[];

  // いいね数・お気に入り数など
  favoritesCount: number;

  // 投稿者情報
  user: User;

  // 添付メディアの配列（画像・動画・音声）
  media: Media[];

  // ビューワーでのブックマーク状態
  bookmarked: boolean;
}

/* ==========================================================================//
/*                               Sub Schemas                                 //
/* ==========================================================================//

/*
 * 投稿者情報
 */
export interface User {
  // プラットフォーム上のユーザーID
  id: string;

  // 表示名
  name: string;

  // 元のURL（例: https://x.com/username...）
  rawUrl: string;

  // プロフィール画像URL
  iconUrl: string;

  // スクリーンネーム（@user）
  screenName?: string;
}

/*
 * メディア情報（画像・動画・音声）
 */
export interface Media {
  // 元のURL（例: https://pbs.twimg.com/...）
  rawUrl: string;

  // ローカル保存パス（manifest基準の相対パス）
  path: string;

  // メディアの種類
  type: "image" | "video" | "audio";
}

/* ==========================================================================//
/*                             Platform-specific                             //
/* ==========================================================================//

/*
 * 媒体固有メタデータ
 *
 * 各拡張機能（minfy-for-x, ...）が
 * 自分のプラットフォームに対応したmetaを出力する
 *
 * Viewer側は `Data.source` を見て正しいパーサーで解釈する
*/
export type PlatformMeta = XMeta | OtherMeta;

// X (Twitter)
export interface XMeta {
  // 引用ツイートの元のID
  // これは、引用ツイートの場合にのみ存在する
  // ビューワー側で、引用元のツイートが存在すれば表示できるようにしたい
  quotedTweetId?: string;

  // 返信先ツイートの元のID
  // これは、ツイートを返信した場合にのみ存在する
  // ビューワー側で、返信先のツイートが存在すれば表示できるようにしたい
  replyToTweetId?: string;
}

// その他
export interface OtherMeta {
  // 任意の拡張プロパティ
  [key: string]: unknown;
}
