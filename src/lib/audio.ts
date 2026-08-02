export type Reciter = {
  id: string;
  name: string;
  /** Folder name on the everyayah.com CDN. */
  folder: string;
  /** Only offered to premium users. */
  premium: boolean;
};

/**
 * Per-ayah recitations hosted on everyayah.com. Al-Husary "Mu'allim" is the
 * default: it is the classic teaching recitation (slow, each ayah clearly
 * separated), which is what memorization beginners need.
 */
export const RECITERS: Reciter[] = [
  { id: "husary_muallim", name: "Al-Husary (Muʿallim)", folder: "Husary_Muallim_128kbps", premium: false },
  { id: "husary", name: "Mahmoud Al-Husary", folder: "Husary_128kbps", premium: true },
  { id: "alafasy", name: "Mishary Al-Afasy", folder: "Alafasy_128kbps", premium: true },
];

export const DEFAULT_RECITER_ID = "husary_muallim";

export function getReciter(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0];
}

export function ayahAudioUrl(reciter: Reciter, surah: number, ayah: number): string {
  const s = String(surah).padStart(3, "0");
  const a = String(ayah).padStart(3, "0");
  return `https://everyayah.com/data/${reciter.folder}/${s}${a}.mp3`;
}
