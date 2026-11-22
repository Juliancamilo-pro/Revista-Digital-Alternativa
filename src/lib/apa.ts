import { ApaReference, Post } from '../types/editorial';
import { toDate } from './utils';

export function buildApaReferenceString(ref: Omit<ApaReference, 'id' | 'formatted'>): string {
  const author = (ref.author || '').trim() || 'Autor institucional';
  const year = (ref.year || '').trim() || 's. f.';
  const title = (ref.title || '').trim();
  const publisher = (ref.publisher || '').trim();
  const url = (ref.url || '').trim();
  const accessDate = (ref.accessDate || '').trim();

  const parts: string[] = [`${author} (${year}).`];
  if (title) {
    parts.push(title.endsWith('.') ? title : `${title}.`);
  }
  if (publisher) {
    parts.push(publisher.endsWith('.') ? publisher : `${publisher}.`);
  }
  if (url) {
    if (accessDate) {
      parts.push(`Recuperado el ${accessDate}, de ${url}`);
    } else {
      parts.push(url);
    }
  }
  return parts.join(' ').trim();
}

export function sortApaReferencesAlphabetically(refs: ApaReference[]): ApaReference[] {
  return [...refs].sort((a, b) =>
    (a.author || a.title || '').localeCompare(b.author || b.title || '', 'es', { sensitivity: 'base' })
  );
}

export function buildArticleCitationApa(
  post: Post,
  resolvedAuthorName: string,
  siteName: string,
  articleUrl: string
): string {
  const pubDate = toDate(post.publishedAt || post.createdAt);
  const year = pubDate.getFullYear();
  const dateFormatted = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(pubDate);
  const author = (resolvedAuthorName || post.authorName || siteName).trim();
  const cleanTitle = (post.title || '').trim().replace(/\.$/, '');
  return `${author} (${year}, ${dateFormatted}). ${cleanTitle}. ${siteName}. ${articleUrl}`;
}
