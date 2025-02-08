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
          backgroundColor: '#fff',
          image: <Image source={require('../assets/onboarding-img1.png')} />,
          title: 'Expense Tracker',
          subtitle:
            'Effortlessly Manage Your Finances and Spending',
        },
        {
          backgroundColor: '#fff',
          image: <Image source={require('../assets/onboarding-img2.png')} />,
          title: 'Split Bill',
          subtitle: 'Easily Share Expenses with Friends and Split Costs',
        },
        {
            backgroundColor: '#fff',
            image: <Image source={require('../assets/onboarding-img3.png')} />,
            title: 'Save and Buy',
            subtitle: "Achieve Your Financial Goals and Plan Your Future",
        },
      ]}
    />
  );
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
