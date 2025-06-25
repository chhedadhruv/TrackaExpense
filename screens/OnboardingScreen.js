import {StyleSheet, Image} from 'react-native';
import React from 'react';
import Onboarding from 'react-native-onboarding-swiper';

const OnboardingScreen = ({navigation}) => {
  return (
    <Onboarding
      onSkip={() => navigation.replace('Login')}
      onDone={() => navigation.replace('Login')}
      pages={[
        {
          backgroundColor: '#FCE9E4',
          image: (
            <Image
              source={require('../assets/monitoring.png')}
              style={styles.image}
              resizeMode="contain"
            />
          ),
          title: 'Track Your Finances',
          subtitle: 'Monitor your expenses and track your spending habits.',
        },
        {
          backgroundColor: '#FDE7DC',
          image: (
            <Image
              source={require('../assets/split.png')}
              style={styles.image}
              resizeMode="contain"
            />
          ),
          title: 'Share Expenses',
          subtitle: 'Quickly split payments and settle up with friends.',
        },
        {
          backgroundColor: '#FDE9DF',
          image: (
            <Image
              source={require('../assets/savings.png')}
              style={styles.image}
              resizeMode="contain"
            />
          ),
          title: 'Save for What Matters',
          subtitle: 'Set savings goals and build a better future, one coin at a time.',
        },
      ]}
    />
  );
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  image: {
    width: 300,
    height: 300,
  },
});
