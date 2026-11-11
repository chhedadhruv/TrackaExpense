import {useState} from 'react';
import {todayAsYMD} from '../utils/formatters';

export interface TransactionFormState {
  title: string;
  description: string;
  amount: string;
  category: string;
  date: string;
  image: string | null;
  tags: string[];
}

interface UseTransactionFormReturn extends TransactionFormState {
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setAmount: (v: string) => void;
  setCategory: (v: string) => void;
  setDate: (v: string) => void;
  setImage: (v: string | null) => void;
  setTags: (v: string[]) => void;
  errorMessage: string | null;
  setErrorMessage: (v: string | null) => void;
  isFormValid: () => boolean;
  validateForm: (type?: 'income' | 'expense') => boolean;
  resetForm: () => void;
}

/**
 * Shared form state and validation for AddExpense, AddIncome, and EditTransactionScreen.
 * Pass initialState to pre-populate in edit mode.
 */
export function useTransactionForm(
  initialState?: Partial<TransactionFormState>,
): UseTransactionFormReturn {
  const [title, setTitle] = useState(initialState?.title ?? '');
  const [description, setDescription] = useState(
    initialState?.description ?? '',
  );
  const [amount, setAmount] = useState(initialState?.amount ?? '');
  const [category, setCategory] = useState(initialState?.category ?? '');
  const [date, setDate] = useState(initialState?.date ?? todayAsYMD());
  const [image, setImage] = useState<string | null>(
    initialState?.image ?? null,
  );
  const [tags, setTags] = useState<string[]>(initialState?.tags ?? []);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFormValid = (): boolean =>
    title.trim() !== '' &&
    amount.trim() !== '' &&
    category !== '' &&
    date !== '' &&
    date !== undefined;

  const validateForm = (type: 'income' | 'expense' = 'expense'): boolean => {
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage(`Please enter a title for your ${type}`);
      return false;
    }
    if (title.trim().length > 100) {
      setErrorMessage('Title must be 100 characters or less');
      return false;
    }
    if (description.trim().length > 500) {
      setErrorMessage('Description must be 500 characters or less');
      return false;
    }
    if (!amount.trim()) {
      setErrorMessage('Please enter an amount');
      return false;
    }
    if (isNaN(Number(amount)) || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return false;
    }
    if (parseFloat(amount) > 999999999) {
      setErrorMessage('Amount must be less than 999,999,999');
      return false;
    }
    if (!category) {
      setErrorMessage('Please select a category');
      return false;
    }
    if (!date) {
      setErrorMessage('Please select a date');
      return false;
    }
    return true;
  };

  const resetForm = (): void => {
    setTitle('');
    setDescription('');
    setAmount('');
    setCategory('');
    setDate(todayAsYMD());
    setImage(null);
    setTags([]);
    setErrorMessage(null);
  };

  return {
    title,
    description,
    amount,
    category,
    date,
    image,
    tags,
    setTags,
    setTitle,
    setDescription,
    setAmount: (v: string) => setAmount(v.replace(/,/g, '')),
    setCategory,
    setDate,
    setImage,
    errorMessage,
    setErrorMessage,
    isFormValid,
    validateForm,
    resetForm,
  };
}
