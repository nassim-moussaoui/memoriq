import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';

import { MaskedArabicVerse, PhoneticLine, splitWords } from '@/components/recall-verse';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getChapter, getVerses } from '@/lib/quran';
import type { ChainItem } from '@/lib/srs/queue';

type IconName = ComponentProps<typeof Ionicons>['name'];
export type ChainOutcome = 'smooth' | 'bumpy' | 'redo';

/**
 * Serial recall of a passage: every verse of the range is masked, the learner
 * recites them in one go and taps a word only when stuck. The self-check is
 * about the transitions ("did I flow from one verse to the next?").
 */
export function ChainStep({
  item,
  isRetry,
  fontScale,
  onDone,
}: {
  item: ChainItem;
  isRetry: boolean;
  fontScale: number;
  onDone: (outcome: ChainOutcome) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const chapter = getChapter(item.surah);
  const verses = getVerses(item.surah).slice(item.from - 1, item.to);
  const [revealed, setRevealed] = useState<Record<number, ReadonlySet<number>>>({});
  const [showAll, setShowAll] = useState(false);

  const totalWords = verses.reduce((n, v) => n + splitWords(v.tr).length, 0);
  const revealedWords = Object.values(revealed).reduce((n, set) => n + set.size, 0);

  const reveal = (ayah: number, index: number) => {
    void Haptics.selectionAsync();
    const next = new Set(revealed[ayah] ?? []);
    next.add(index);
    const updated = { ...revealed, [ayah]: next };
    setRevealed(updated);
    const count = Object.values(updated).reduce((n, set) => n + set.size, 0);
    if (count >= totalWords) setShowAll(true);
  };

  const options: { key: ChainOutcome; icon: IconName; color: string }[] = [
    { key: 'redo', icon: 'refresh', color: theme.danger },
    { key: 'bumpy', icon: 'git-commit-outline', color: theme.warning },
    { key: 'smooth', icon: 'checkmark-done', color: theme.tint },
  ];

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInRight.duration(320)} style={styles.block}>
          <View style={styles.contextRow}>
            <View style={[styles.chip, { backgroundColor: (isRetry ? theme.danger : theme.warning) + '22' }]}>
              <Ionicons name="link" size={13} color={isRetry ? theme.danger : theme.warning} />
              <ThemedText type="smallBold" style={{ color: isRetry ? theme.danger : theme.warning }}>
                {isRetry ? t('session.retryBadge') : t('chain.badge')}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
              {t('chain.range', { surah: chapter.nameSimple, from: item.from, to: item.to })}
            </ThemedText>
          </View>

          <ThemedText style={styles.title}>{t('chain.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            {showAll ? t('chain.rateHint') : t('chain.hint')}
          </ThemedText>

          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {verses.map((verse, i) => (
              <View key={verse.v} style={styles.verse}>
                {i > 0 ? (
                  <View style={styles.joint}>
                    <View style={[styles.jointLine, { backgroundColor: theme.backgroundSelected }]} />
                    <Ionicons name="arrow-down" size={12} color={theme.textSecondary} />
                    <View style={[styles.jointLine, { backgroundColor: theme.backgroundSelected }]} />
                  </View>
                ) : null}
                <View style={styles.verseHead}>
                  <View style={[styles.ayah, { borderColor: theme.backgroundSelected }]}>
                    <ThemedText style={styles.ayahText}>{verse.v}</ThemedText>
                  </View>
                </View>
                <MaskedArabicVerse
                  text={verse.ar}
                  revealed={showAll ? 'all' : (revealed[verse.v] ?? new Set())}
                  onReveal={showAll ? undefined : (w) => reveal(verse.v, w)}
                  fontScale={fontScale}
                />
                <PhoneticLine
                  text={verse.tr}
                  revealed={showAll ? 'all' : (revealed[verse.v] ?? new Set())}
                  onReveal={showAll ? undefined : (w) => reveal(verse.v, w)}
                />
              </View>
            ))}
          </View>

          {!showAll && revealedWords > 0 ? (
            <ThemedText style={[styles.counter, { color: theme.textSecondary }]}>
              {t('session.wordsChecked', { count: revealedWords, total: totalWords })}
            </ThemedText>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        {showAll ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.rateWrap}>
            <ThemedText style={styles.question}>{t('chain.question')}</ThemedText>
            <View style={styles.rateRow}>
              {options.map((o, i) => (
                <Animated.View
                  key={o.key}
                  entering={FadeInDown.delay(i * 60).springify().damping(18)}
                  style={styles.flex}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void (o.key === 'redo'
                        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
                      onDone(o.key);
                    }}
                    style={({ pressed }) => [
                      styles.rateCard,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: o.color + '55',
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      },
                    ]}>
                    <View style={[styles.rateIcon, { backgroundColor: o.color + '22' }]}>
                      <Ionicons name={o.icon} size={18} color={o.color} />
                    </View>
                    <ThemedText style={[styles.rateLabel, { color: o.color }]}>
                      {t(`chain.${o.key}`)}
                    </ThemedText>
                    <ThemedText style={[styles.rateDesc, { color: theme.textSecondary }]}>
                      {t(`chain.${o.key}Desc`)}
                    </ThemedText>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : (
          <PrimaryButton label={t('chain.show')} icon="eye-outline" onPress={() => setShowAll(true)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingVertical: Spacing.two, flexGrow: 1 },
  block: { gap: Spacing.three },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 800 },
  body: { fontWeight: 400, lineHeight: 20, marginTop: -Spacing.two },
  card: { borderRadius: 24, padding: Spacing.four, gap: Spacing.two },
  verse: { gap: Spacing.two },
  joint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  jointLine: { flex: 1, height: 1 },
  verseHead: { flexDirection: 'row', justifyContent: 'center' },
  ayah: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahText: { fontSize: 11, lineHeight: 14, fontWeight: 800, transform: [{ rotate: '-45deg' }] },
  counter: { fontSize: 12, lineHeight: 16, paddingHorizontal: Spacing.one },
  footer: { paddingTop: Spacing.two, paddingBottom: Spacing.three },
  rateWrap: { gap: Spacing.two },
  question: { fontSize: 15, lineHeight: 20, fontWeight: 700, textAlign: 'center' },
  rateRow: { flexDirection: 'row', gap: Spacing.two },
  rateCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.three,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    minHeight: 128,
  },
  rateIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rateLabel: { fontSize: 14.5, lineHeight: 19, fontWeight: 800, textAlign: 'center' },
  rateDesc: { fontSize: 11.5, lineHeight: 15, textAlign: 'center' },
});
