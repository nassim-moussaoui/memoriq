import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { ayahAudioUrl, type Reciter } from "@/lib/audio";

/**
 * Offline cache of per-ayah recitations. A verse is streamed the first time
 * it is played and saved to the documents folder in the background, so every
 * later listen (the whole point of repetition) works without a network, at
 * the mosque or on the move. Downloads land in a ".part" file first and are
 * moved into place only once complete, so a cut connection never leaves a
 * truncated mp3 behind.
 */

const enabled = Platform.OS !== "web";
const inFlight = new Map<string, Promise<void>>();

function fileName(surah: number, ayah: number) {
  return `${String(surah).padStart(3, "0")}${String(ayah).padStart(3, "0")}.mp3`;
}

function reciterDir(reciter: Reciter): Directory {
  return new Directory(Paths.document, "audio", reciter.folder);
}

/** Local file URI when the verse is already cached, otherwise null. */
export function cachedAyahUri(reciter: Reciter, surah: number, ayah: number): string | null {
  if (!enabled) return null;
  try {
    const file = new File(reciterDir(reciter), fileName(surah, ayah));
    return file.exists && (file.size ?? 0) > 0 ? file.uri : null;
  } catch {
    return null;
  }
}

/** Downloads one verse into the cache (deduplicated, failures are silent). */
export function cacheAyah(reciter: Reciter, surah: number, ayah: number): Promise<void> {
  if (!enabled || cachedAyahUri(reciter, surah, ayah)) return Promise.resolve();
  const key = `${reciter.folder}/${fileName(surah, ayah)}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = (async () => {
    try {
      const dir = reciterDir(reciter);
      dir.create({ intermediates: true, idempotent: true });
      const part = new File(dir, `${fileName(surah, ayah)}.part`);
      const downloaded = await File.downloadFileAsync(ayahAudioUrl(reciter, surah, ayah), part, {
        idempotent: true,
      });
      await downloaded.move(new File(dir, fileName(surah, ayah)));
    } catch {
      // Offline or CDN hiccup: the verse simply streams next time.
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, task);
  return task;
}

/** The URI to play: the cached file when present, else the CDN stream. */
export function ayahSource(reciter: Reciter, surah: number, ayah: number): string {
  return cachedAyahUri(reciter, surah, ayah) ?? ayahAudioUrl(reciter, surah, ayah);
}

/** Caches a list of verses one after the other (gentle on the network). */
export async function prefetchAyahs(
  reciter: Reciter,
  verses: { surah: number; ayah: number }[],
): Promise<void> {
  for (const v of verses) await cacheAyah(reciter, v.surah, v.ayah);
}
