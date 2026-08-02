import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useRef, useState } from "react";

import { ayahAudioUrl, getReciter } from "@/lib/audio";
import { useAppStore } from "@/lib/store";

export type PlayingAyah = { surah: number; ayah: number };

/**
 * Streams per-ayah recitation from the everyayah.com CDN using the reciter
 * selected in settings. `onFinished` fires when an ayah ends, letting callers
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
    player.replace({ uri: ayahAudioUrl(reciter, surah, ayah) });
    // Pitch correction keeps a slowed recitation faithful to the tajwid.
    player.setPlaybackRate(playbackRate, "high");
    player.play();
  };

  const stop = () => {
    playingRef.current = null;
    setPlaying(null);
    player.pause();
    player.seekTo(0);
  };

  return { play, stop, playing };
}
