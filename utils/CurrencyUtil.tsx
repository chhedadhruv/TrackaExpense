import React, {createContext, useContext, useState, useEffect} from 'react';
import {
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import type {Currency} from '../src/types';

export const CURRENCIES: Currency[] = [
  {code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN'},
  {code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US'},
  {code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE'},
  {code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB'},
  {code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP'},
  {code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU'},
  {code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA'},
  {code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH'},
  {code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN'},
  {code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE'},
  {code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG'},
  {code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'en-HK'},
  {code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ'},
  {code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE'},
  {code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'no-NO'},
  {code: 'DKK', symbol: 'kr', name: 'Danish Krone', locale: 'da-DK'},
  {code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR'},
  {code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', locale: 'es-MX'},
  {code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA'},
  {code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR'},
];

const DEFAULT_CURRENCY = CURRENCIES[0]; // INR

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (code: string) => Promise<void>;
  formatAmount: (
    amount: number | string,
    showSymbol?: boolean,
    showCode?: boolean,
  ) => string;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  setCurrency: async () => {},
  formatAmount: amount => String(amount),
  loading: true,
});

export const CurrencyProvider = ({children}: {children: React.ReactNode}) => {
  const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserCurrency();
  }, []);

  const fetchUserCurrency = async () => {
    try {
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        const userDoc = await getDoc(
          doc(getFirestore(), 'users', currentUser.uid),
        );
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData?.currency) {
            const userCurrency = CURRENCIES.find(
              c => c.code === userData.currency,
            );
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

  const setCurrency = async (currencyCode: string) => {
    try {
      const newCurrency = CURRENCIES.find(c => c.code === currencyCode);
      if (newCurrency) {
        setCurrencyState(newCurrency);
        const currentUser = getAuth().currentUser;
        if (currentUser) {
          await updateDoc(doc(getFirestore(), 'users', currentUser.uid), {
            currency: currencyCode,
          });
        }
      }
    } catch (error) {
      console.error('Error updating currency:', error);
      throw error;
    }
  };

  const formatAmount = (
    amount: number | string,
    showSymbol = true,
    showCode = false,
  ): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) {
      return '0';
    }
    const formattedNumber = numAmount.toLocaleString(currency.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    if (showSymbol && showCode) {
      return `${currency.symbol}${formattedNumber} ${currency.code}`;
    }
    if (showSymbol) {
      return `${currency.symbol}${formattedNumber}`;
    }
    if (showCode) {
      return `${formattedNumber} ${currency.code}`;
    }
    return formattedNumber;
  };

  return (
    <CurrencyContext.Provider
      value={{currency, setCurrency, formatAmount, loading}}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextValue => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const getCurrencyByCode = (code: string): Currency =>
  CURRENCIES.find(c => c.code === code) ?? DEFAULT_CURRENCY;

/** Format currency without context — for backwards compatibility. */
export const formatCurrency = (
  amount: number | string,
  currencyCode = 'INR',
): string => {
  const cur = getCurrencyByCode(currencyCode);
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) {
    return '0';
  }
  const formattedNumber = numAmount.toLocaleString(cur.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${cur.symbol}${formattedNumber}`;
};
