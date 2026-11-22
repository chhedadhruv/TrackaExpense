import React, {useEffect, useRef, useState} from 'react';
import {useRouter} from 'expo-router';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useThemedStyles, type ThemeColors} from '../src/theme';
import * as AnalyticsService from '../src/services/AnalyticsService';
import OnboardingArt from '../src/components/illustrations/OnboardingIllustrations';
import {
  ONBOARDING_PAGES,
  type OnboardingPage,
} from '../src/constants/onboardingContent';

const OnboardingScreen = () => {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const {width} = useWindowDimensions();
  const listRef = useRef<FlatList<OnboardingPage>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === ONBOARDING_PAGES.length - 1;
  // Leaves room for the title, text and footer on a small phone.
  const artSize = Math.min(300, Math.round(width * 0.78));

  useEffect(() => {
    AnalyticsService.logOnboardingStarted();
  }, []);

  const finish = () => router.replace('/login');
  const skip = () => {
    AnalyticsService.logOnboardingSkipped(index + 1);
    finish();
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (isLast) {
      AnalyticsService.logOnboardingCompleted();
      finish();
      return;
    }
    listRef.current?.scrollToIndex({index: index + 1, animated: true});
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={listRef}
        data={ONBOARDING_PAGES}
        keyExtractor={item => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({length: width, offset: width * i, index: i})}
        renderItem={({item}) => (
          <View style={[styles.page, {width}]}>
            <OnboardingArt
              name={item.illustration}
              label={item.imageLabel}
              size={artSize}
            />
            <Text style={styles.title} accessibilityRole="header">
              {item.title}
            </Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={skip}
          hitSlop={12}
          disabled={isLast}
          accessibilityRole="button"
          accessibilityLabel="Skip introduction">
          <Text style={[styles.skip, isLast ? styles.hidden : null]}>Skip</Text>
        </TouchableOpacity>
        <View style={styles.dots}>
          {ONBOARDING_PAGES.map((p, i) => (
            <View
              key={p.title}
              style={[styles.dot, i === index ? styles.dotActive : null]}
            />
          ))}
        </View>
        <TouchableOpacity
          onPress={next}
          hitSlop={12}
          accessibilityRole="button">
          <Text style={styles.next}>{isLast ? 'Done' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    page: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.textStrong,
      marginTop: 24,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 23,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 12,
      paddingHorizontal: 16,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    skip: {fontSize: 16, color: colors.textSecondary},
    hidden: {opacity: 0},
    next: {fontSize: 16, fontWeight: '600', color: colors.primary},
    dots: {flexDirection: 'row'},
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginHorizontal: 4,
      backgroundColor: colors.border,
    },
    dotActive: {backgroundColor: colors.primaryFill},
  });
