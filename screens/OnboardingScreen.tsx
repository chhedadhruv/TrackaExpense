import React, {useRef, useState} from 'react';
import {
  FlatList,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {PRIMARY_COLOR} from '../src/constants/theme';

interface Page {
  backgroundColor: string;
  image: ImageSourcePropType;
  title: string;
  subtitle: string;
}

const PAGES: Page[] = [
  {
    backgroundColor: '#FCE9E4',
    image: require('../assets/monitoring.png'),
    title: 'Track Your Finances',
    subtitle: 'Monitor your expenses and track your spending habits.',
  },
  {
    backgroundColor: '#FDE7DC',
    image: require('../assets/split.png'),
    title: 'Share Expenses',
    subtitle: 'Quickly split payments and settle up with friends.',
  },
  {
    backgroundColor: '#FDE9DF',
    image: require('../assets/savings.png'),
    title: 'Save for What Matters',
    subtitle:
      'Set savings goals and build a better future, one coin at a time.',
  },
];

const OnboardingScreen = ({navigation}: {navigation: any}) => {
  const {width} = useWindowDimensions();
  const listRef = useRef<FlatList<Page>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === PAGES.length - 1;

  const finish = () => navigation.replace('Login');

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    listRef.current?.scrollToIndex({index: index + 1, animated: true});
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {backgroundColor: PAGES[index].backgroundColor},
      ]}>
      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={item => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({length: width, offset: width * i, index: i})}
        renderItem={({item}) => (
          <View style={[styles.page, {width}]}>
            <Image
              source={item.image}
              style={styles.image}
              resizeMode="contain"
            />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />
      <View style={styles.footer}>
        <TouchableOpacity onPress={finish} hitSlop={12} disabled={isLast}>
          <Text style={[styles.skip, isLast ? styles.hidden : null]}>Skip</Text>
        </TouchableOpacity>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View
              key={p.title}
              style={[styles.dot, i === index ? styles.dotActive : null]}
            />
          ))}
        </View>
        <TouchableOpacity onPress={next} hitSlop={12}>
          <Text style={styles.next}>{isLast ? 'Done' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  container: {flex: 1},
  page: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  image: {width: 300, height: 300},
  title: {fontSize: 26, fontWeight: '700', color: '#222', marginTop: 24},
  subtitle: {
    fontSize: 16,
    color: '#444',
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
  skip: {fontSize: 16, color: '#444'},
  hidden: {opacity: 0},
  next: {fontSize: 16, fontWeight: '600', color: PRIMARY_COLOR},
  dots: {flexDirection: 'row'},
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dotActive: {backgroundColor: '#222'},
});
