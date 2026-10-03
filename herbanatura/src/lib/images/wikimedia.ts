import 'server-only';
import type { ImageRef } from '@/lib/domain/types';

const UA = 'HerbaNatura/0.1 (educational encyclopedia)';

/** Strip HTML from Commons metadata (artist fields contain markup). */
const text = (html?: string) => (html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

type CommonsInfo = { url: string; thumburl?: string; descriptionurl: string; extmetadata?: Record<string, { value?: string }> };

/**
 * Resolve an illustrative photo for a scientific name from Wikimedia Commons,
 * with author and license (always displayed). Returns null on any failure.
 */
export async function wikimediaImage(scientificName: string): Promise<ImageRef | null> {
  const title = scientificName.split(' ').slice(0, 2).join('_');
  if (!/^[A-Z][a-z]+_[a-z×-]+$/.test(title)) return null;
  const opts = { headers: { 'User-Agent': UA }, next: { revalidate: 60 * 60 * 24 * 7 }, signal: AbortSignal.timeout(3000) };
  try {
    const page = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=name&redirects=1&titles=${encodeURIComponent(title)}`,
      opts,
    ).then((r) => r.json());
    const pages = Object.values(page?.query?.pages ?? {}) as { pageimage?: string }[];
    const file = pages[0]?.pageimage;
    if (!file) return null;
    const info = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=960&titles=${encodeURIComponent('File:' + file)}`,
      opts,
    ).then((r) => r.json());
    const ii = (Object.values(info?.query?.pages ?? {}) as { imageinfo?: CommonsInfo[] }[])[0]?.imageinfo?.[0];
    if (!ii) return null;
    const meta = ii.extmetadata ?? {};
    return {
      url: ii.url,
      thumbUrl: ii.thumburl ?? ii.url,
      author: text(meta.Artist?.value) || 'Wikimedia Commons',
      license: text(meta.LicenseShortName?.value) || 'ver fuente',
      sourceUrl: ii.descriptionurl,
      caption: null,
      verified: false,
    };
  } catch {
    return null;
  }
}
