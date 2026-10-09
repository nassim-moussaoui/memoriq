import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { enterUp, type IconName } from '@/components/onboarding/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ICONS: IconName[] = ['ear-outline', 'repeat-outline', 'moon-outline', 'leaf-outline'];
const GAP = Spacing.three;

function HadithCard({
  index,
  scrollX,
  cardWidth,
}: {
  index: number;
  scrollX: SharedValue<number>;
  cardWidth: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const n = index + 1;
  const stride = cardWidth + GAP;
  // Neighbours shrink and dim a little, so the focused hadith stands forward.
  const animatedStyle = useAnimatedStyle(() => {
    const p = scrollX.value / stride;
    return {
      opacity: interpolate(p, [index - 1, index, index + 1], [0.55, 1, 0.55], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(p, [index - 1, index, index + 1], [0.92, 1, 0.92], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.card,
        { width: cardWidth, backgroundColor: theme.backgroundElement },
        animatedStyle,
      ]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBubble, { backgroundColor: theme.tint }]}>
          <Ionicons name={ICONS[index]} size={18} color="#ffffff" />
        </View>
        <ThemedText style={styles.cardTitle}>{t(`onboarding.hadith${n}Title`)}</ThemedText>
      </View>
      <View style={[styles.quote, { borderStartColor: theme.tint }]}>
        <ThemedText style={styles.quoteText}>{t(`onboarding.hadith${n}Quote`)}</ThemedText>
        <ThemedText style={[styles.source, { color: theme.textSecondary }]}>
          {t(`onboarding.hadith${n}Narrator`)}
        </ThemedText>
        <ThemedText style={[styles.source, { color: theme.tint }]}>
          {t(`onboarding.hadith${n}Source`)}
        </ThemedText>
      </View>
      <View style={[styles.method, { backgroundColor: theme.background }]}>
        <ThemedText type="smallBold" style={{ color: theme.tint }}>
          {t('onboarding.methodLabel')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.methodText}>
          {t(`onboarding.hadith${n}Method`)}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

function Dot({ index, scrollX, stride }: { index: number; scrollX: SharedValue<number>; stride: number }) {
  const theme = useTheme();
  const animatedStyle = useAnimatedStyle(() => {
    const p = scrollX.value / stride;
    return {
      width: interpolate(p, [index - 1, index, index + 1], [7, 20, 7], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(
        p,
        [index - 1, index, index + 1],
        [theme.backgroundSelected, theme.tint, theme.backgroundSelected],
      ),
    };
  });
  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

/** The four prophetic teachings as a snapping deck of cards. */
export function HadithCarousel({ width }: { width: number }) {
  const scrollX = useSharedValue(0);
  const cardWidth = width - Spacing.four * 2;
  const stride = cardWidth + GAP;
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  return (
    <Animated.View entering={enterUp(3)} style={styles.wrap}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={stride}
        contentContainerStyle={styles.track}
        onScroll={onScroll}
        scrollEventThrottle={16}>
        {ICONS.map((icon, i) => (
          <HadithCard key={icon} index={i} scrollX={scrollX} cardWidth={cardWidth} />
        ))}
      </Animated.ScrollView>
      <View style={styles.dots}>
        {ICONS.map((icon, i) => (
          <Dot key={icon} index={i} scrollX={scrollX} stride={stride} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  track: { paddingHorizontal: Spacing.four, gap: GAP, alignItems: 'stretch' },
  card: { borderRadius: 24, padding: Spacing.four, gap: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: 700 },
  quote: { borderStartWidth: 3, paddingStart: Spacing.three, gap: Spacing.one },
  quoteText: { fontSize: 15, lineHeight: 23, fontStyle: 'italic' },
  source: { fontSize: 12, lineHeight: 16, fontWeight: 600 },
  method: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one, marginTop: 'auto' },
  methodText: { fontWeight: 400, lineHeight: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  dot: { height: 7, borderRadius: 4 },
});
