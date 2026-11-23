import { Post } from '../types/editorial';

const FEED_CACHE_KEY = 'revista_cache_feed_v1';
const ARTICLE_CACHE_PREFIX = 'revista_cache_article_v1_';
const ARTICLE_INDEX_KEY = 'revista_cache_article_index_v1';
const MAX_CACHED_FEED = 24;
const MAX_CACHED_ARTICLES = 16;

function compactPostForCache(post: Post): Post {
  const safeCover =
    post.coverImage && post.coverImage.startsWith('data:') && post.coverImage.length > 120000
      ? undefined
      : post.coverImage;
  const safeAvatar =
    post.authorAvatar && post.authorAvatar.startsWith('data:') && post.authorAvatar.length > 60000
      ? undefined
      : post.authorAvatar;
  return {
    ...post,
    ...(safeCover !== undefined ? { coverImage: safeCover } : {}),
    ...(safeAvatar !== undefined ? { authorAvatar: safeAvatar } : {}),
  };
}

export function saveFeedCache(posts: Post[]): void {
  if (typeof window === 'undefined' || !posts.length) return;
  try {
    const compact = posts.slice(0, MAX_CACHED_FEED).map((p) => {
      const base = compactPostForCache(p);
      // Omit heavy blocks in feed list cache to keep footprint tiny
      return {
        ...base,
        blocks: (base.blocks || []).slice(0, 2),
      };
    });
    localStorage.setItem(
      FEED_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        posts: compact,
      })
    );
  } catch {
    // Ignore storage quota issues
  }
}

export function loadFeedCache(): Post[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { savedAt?: number; posts?: Post[] };
    if (!Array.isArray(parsed.posts)) return [];
    return parsed.posts;
  } catch {
    return [];
  }
}

export function saveVisitedArticle(post: Post): void {
  if (typeof window === 'undefined' || !post?.slug || post.status !== 'published') return;
  try {
    const compact = compactPostForCache(post);
    const key = `${ARTICLE_CACHE_PREFIX}${post.slug}`;
    localStorage.setItem(key, JSON.stringify(compact));

    const idxRaw = localStorage.getItem(ARTICLE_INDEX_KEY);
    const prevIdx: string[] = idxRaw ? (JSON.parse(idxRaw) as string[]) : [];
    const nextIdx = [post.slug, ...prevIdx.filter((s) => s !== post.slug)];

    while (nextIdx.length > MAX_CACHED_ARTICLES) {
      const evicted = nextIdx.pop();
      if (evicted) {
        localStorage.removeItem(`${ARTICLE_CACHE_PREFIX}${evicted}`);
      }
    }
    localStorage.setItem(ARTICLE_INDEX_KEY, JSON.stringify(nextIdx));
  } catch {
    // Ignore quota issues cleanly
  }
}

export function loadVisitedArticle(slugOrId: string): Post | null {
  if (typeof window === 'undefined' || !slugOrId) return null;
  try {
    const raw = localStorage.getItem(`${ARTICLE_CACHE_PREFIX}${slugOrId}`);
    if (raw) {
      return JSON.parse(raw) as Post;
    }
    const idxRaw = localStorage.getItem(ARTICLE_INDEX_KEY);
    const idxList: string[] = idxRaw ? (JSON.parse(idxRaw) as string[]) : [];
    for (const slug of idxList) {
      const itemRaw = localStorage.getItem(`${ARTICLE_CACHE_PREFIX}${slug}`);
      if (!itemRaw) continue;
      const item = JSON.parse(itemRaw) as Post;
      if (item.id === slugOrId || item.slug === slugOrId) {
        return item;
      }
    }
    return null;
  } catch {
    return null;
  }
}
