import {View, Text, StyleSheet, Image, ActivityIndicator} from 'react-native';
import React, {useState} from 'react';
import Onboarding from 'react-native-onboarding-swiper';

const OnboardingScreen = ({navigation}) => {
  const [loading, setLoading] = useState(true);

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = () => {
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {loading && (
        <ActivityIndicator
          size="large"
          color="#677CD2"
          style={styles.loadingIndicator}
        />
      )}
      <Onboarding
        onSkip={() => navigation.replace('Login')}
        onDone={() => navigation.replace('Login')}
        pages={[
          {
            backgroundColor: '#fff',
            image: (
              <Image
                source={require('../assets/onboarding-img1.png')}
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={styles.image}
              />
            ),
            title: 'Expense Tracker',
            subtitle: 'Effortlessly Manage Your Finances and Spending',
          },
          {
            backgroundColor: '#fff',
            image: (
              <Image
                source={require('../assets/onboarding-img2.png')}
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={styles.image}
              />
            ),
            title: 'Split Bill',
            subtitle: 'Easily Share Expenses with Friends and Split Costs',
          },
          {
            backgroundColor: '#fff',
            image: (
              <Image
                source={require('../assets/onboarding-img3.png')}
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={styles.image}
              />
            ),
            title: 'Save and Buy',
            subtitle: 'Achieve Your Financial Goals and Plan Your Future',
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
  },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    zIndex: 1,
  },
});

export default OnboardingScreen;
