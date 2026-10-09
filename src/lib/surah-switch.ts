import { Alert } from "react-native";

import i18n from "@/lib/i18n";
import { getChapter } from "@/lib/quran";
import { getStartedAyahs } from "@/lib/srs/db";
import { nextSegment } from "@/lib/srs/queue";

/**
 * Switching the surah being learned while the current one is half done
 * scatters attention: the traditional method finishes one sabaq before the
 * next. This asks for confirmation in that case (and only then), reminding
 * that the reviews of the current surah keep going either way.
 */
export function confirmSurahSwitch(from: number, to: number, onConfirm: () => void): void {
  const started = from === to ? 0 : getStartedAyahs(from).size;
  const inProgress = started > 0 && nextSegment(from) !== null;
  if (!inProgress) {
    onConfirm();
    return;
  }
  const current = getChapter(from);
  const next = getChapter(to);
  Alert.alert(
    i18n.t("switch.title"),
    i18n.t("switch.body", {
      from: current.nameSimple,
      started,
      total: current.versesCount,
    }),
    [
      { text: i18n.t("switch.stay", { surah: current.nameSimple }), style: "cancel" },
      { text: i18n.t("switch.go", { surah: next.nameSimple }), onPress: onConfirm },
    ]
  );
}
