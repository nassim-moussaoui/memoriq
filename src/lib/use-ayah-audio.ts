import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useRef, useState } from "react";

import { getReciter } from "@/lib/audio";
import { ayahSource, cacheAyah } from "@/lib/audio-cache";
import { getChapter } from "@/lib/quran";
import { useAppStore } from "@/lib/store";

export type PlayingAyah = { surah: number; ayah: number };

/**
 * Plays per-ayah recitation with the reciter selected in settings: from the
 * offline cache when available, streamed from everyayah.com otherwise (and
 * then cached, along with the next verse). Playback keeps going in the
 * background and shows the verse on the lock screen. `onFinished` fires when an ayah ends, letting callers
 * implement auto-advance or looping.
 */
export function useAyahAudio(onFinished?: (played: PlayingAyah) => void) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const reciterId = useAppStore((s) => s.reciterId);
  const playbackRate = useAppStore((s) => s.playbackRate);
  const [playing, setPlaying] = useState<PlayingAyah | null>(null);
  const playingRef = useRef<PlayingAyah | null>(null);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  useEffect(() => {
    if (status.didJustFinish && playingRef.current) {
      const played = playingRef.current;
      playingRef.current = null;
      setPlaying(null);
      onFinishedRef.current?.(played);
    }
  }, [status.didJustFinish]);

  const play = (surah: number, ayah: number) => {
    const reciter = getReciter(reciterId);
    playingRef.current = { surah, ayah };
    setPlaying({ surah, ayah });
    player.replace({ uri: ayahSource(reciter, surah, ayah) });
    // Pitch correction keeps a slowed recitation faithful to the tajwid.
    player.setPlaybackRate(playbackRate, "high");
    player.play();
    try {
      const chapter = getChapter(surah);
      player.setActiveForLockScreen(true, {
        title: `${chapter.nameSimple} ${surah}:${ayah}`,
        artist: reciter.name,
        albumTitle: "Memoriq",
      });
    } catch {
      // Lock screen info is a nicety, never a reason to fail playback.
    }
    void cacheAyah(reciter, surah, ayah);
    if (ayah < getChapter(surah).versesCount) void cacheAyah(reciter, surah, ayah + 1);
  };

  const stop = () => {
    playingRef.current = null;
    setPlaying(null);
    player.pause();
    player.seekTo(0);
  };

  return { play, stop, playing };
}
