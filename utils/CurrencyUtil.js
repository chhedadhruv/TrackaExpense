import React, { createContext, useContext, useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Currency options with symbols and names
export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'en-HK' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'no-NO' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', locale: 'da-DK' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', locale: 'es-MX' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
];

// Default currency
const DEFAULT_CURRENCY = CURRENCIES[0]; // INR

// Currency Context
const CurrencyContext = createContext({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
  formatAmount: (amount) => amount,
});

// Currency Provider Component
export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrencyState] = useState(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserCurrency();
  }, []);

  const fetchUserCurrency = async () => {
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        const userDoc = await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.currency) {
            const userCurrency = CURRENCIES.find(c => c.code === userData.currency);
            if (userCurrency) {
              setCurrencyState(userCurrency);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user currency:', error);
    } finally {
      setLoading(false);
    }
  };

  const setCurrency = async (currencyCode) => {
    try {
      const newCurrency = CURRENCIES.find(c => c.code === currencyCode);
      if (newCurrency) {
        setCurrencyState(newCurrency);
        
        // Save to Firestore
        const currentUser = auth().currentUser;
        if (currentUser) {
          await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .update({
              currency: currencyCode,
            });
        }
      }
    } catch (error) {
      console.error('Error updating currency:', error);
      throw error;
    }
  };

  const formatAmount = (amount, showSymbol = true, showCode = false) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount)) return '0';
    
    const formattedNumber = numAmount.toLocaleString(currency.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    
    if (showSymbol && showCode) {
      return `${currency.symbol} ${formattedNumber} ${currency.code}`;
    } else if (showSymbol) {
      return `${currency.symbol} ${formattedNumber}`;
    } else if (showCode) {
      return `${formattedNumber} ${currency.code}`;
    }
    
    return formattedNumber;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};

// Custom hook to use currency
export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

// Helper function to get currency by code
export const getCurrencyByCode = (code) => {
  return CURRENCIES.find(c => c.code === code) || DEFAULT_CURRENCY;
};

// Helper function to format currency without context (for backwards compatibility)
export const formatCurrency = (amount, currencyCode = 'INR') => {
  const currency = getCurrencyByCode(currencyCode);
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '0';
  
  const formattedNumber = numAmount.toLocaleString(currency.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  
  return `${currency.symbol} ${formattedNumber}`;
};

