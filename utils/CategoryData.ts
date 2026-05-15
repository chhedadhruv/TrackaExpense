import type {Category} from '../src/types';

export const EXPENSE_CATEGORIES: readonly Category[] = [
  {value: 'Food', label: 'Food', icon: 'food-fork-drink'},
  {value: 'Groceries', label: 'Groceries', icon: 'cart'},
  {value: 'Shopping', label: 'Shopping', icon: 'shopping'},
  {value: 'Bills', label: 'Bills', icon: 'file-document'},
  {value: 'Rent', label: 'Rent', icon: 'home'},
  {value: 'Travel', label: 'Travel', icon: 'airplane'},
  {value: 'Entertainment', label: 'Entertainment', icon: 'movie'},
  {value: 'Health', label: 'Health', icon: 'medical-bag'},
  {value: 'Education', label: 'Education', icon: 'school'},
  {value: 'Fitness', label: 'Fitness', icon: 'dumbbell'},
  {value: 'Subscriptions', label: 'Subscriptions', icon: 'repeat'},
  {value: 'Others', label: 'Others', icon: 'shape-outline'},
] as const;

export const INCOME_CATEGORIES: readonly Category[] = [
  {value: 'Salary', label: 'Salary', icon: 'briefcase'},
  {value: 'Bonus', label: 'Bonus', icon: 'star-circle'},
  {value: 'Gift', label: 'Gift', icon: 'gift'},
  {value: 'Freelance', label: 'Freelance', icon: 'laptop'},
  {value: 'Investment', label: 'Investment', icon: 'trending-up'},
  {value: 'Cashback', label: 'Cashback', icon: 'cash-refund'},
  {value: 'Others', label: 'Others', icon: 'shape-outline'},
] as const;

export const SPLIT_CATEGORIES: readonly Category[] = [
  {value: 'Food', label: 'Food', icon: 'food-fork-drink'},
  {value: 'Shopping', label: 'Shopping', icon: 'shopping'},
  {value: 'Entertainment', label: 'Entertainment', icon: 'movie'},
  {value: 'Transport', label: 'Transport', icon: 'car'},
  {value: 'Bills', label: 'Bills', icon: 'file-document'},
  {value: 'Others', label: 'Others', icon: 'shape-outline'},
] as const;

export const EXPENSE_KEYWORD_MAP: Record<string, string> = {
  // Food
  lunch: 'Food', dinner: 'Food', breakfast: 'Food', snacks: 'Food', snack: 'Food',
  meal: 'Food', meals: 'Food', food: 'Food', restaurant: 'Food', cafe: 'Food',
  pizza: 'Food', burger: 'Food', biryani: 'Food', sushi: 'Food', coffee: 'Food',
  zomato: 'Food', swiggy: 'Food', mcdonalds: 'Food', kfc: 'Food', subway: 'Food',
  dominos: 'Food', starbucks: 'Food',
  // Groceries
  grocery: 'Groceries', groceries: 'Groceries', supermarket: 'Groceries',
  vegetables: 'Groceries', fruits: 'Groceries', milk: 'Groceries', bread: 'Groceries',
  blinkit: 'Groceries', zepto: 'Groceries', instamart: 'Groceries',
  bigbasket: 'Groceries', dmart: 'Groceries',
  // Shopping
  amazon: 'Shopping', flipkart: 'Shopping', myntra: 'Shopping', ajio: 'Shopping',
  shopping: 'Shopping', clothes: 'Shopping', shoes: 'Shopping', dress: 'Shopping',
  // Bills & Utilities
  electricity: 'Bills', 'electric bill': 'Bills', water: 'Bills', 'gas bill': 'Bills',
  internet: 'Bills', broadband: 'Bills', 'phone bill': 'Bills', utility: 'Bills',
  // Rent
  rent: 'Rent', 'house rent': 'Rent', apartment: 'Rent', flat: 'Rent',
  pg: 'Rent', hostel: 'Rent',
  // Travel
  uber: 'Travel', ola: 'Travel', rapido: 'Travel', taxi: 'Travel',
  flight: 'Travel', train: 'Travel', bus: 'Travel', metro: 'Travel',
  travel: 'Travel', hotel: 'Travel', irctc: 'Travel', trip: 'Travel',
  // Entertainment
  netflix: 'Entertainment', hotstar: 'Entertainment', 'amazon prime': 'Entertainment',
  disney: 'Entertainment', spotify: 'Entertainment', youtube: 'Entertainment',
  movie: 'Entertainment', cinema: 'Entertainment', theatre: 'Entertainment',
  concert: 'Entertainment', gaming: 'Entertainment',
  // Health
  doctor: 'Health', hospital: 'Health', medicine: 'Health', pharmacy: 'Health',
  medical: 'Health', clinic: 'Health', health: 'Health', dentist: 'Health',
  // Education
  school: 'Education', college: 'Education', university: 'Education',
  course: 'Education', tuition: 'Education', udemy: 'Education',
  coursera: 'Education', books: 'Education',
  // Fitness
  gym: 'Fitness', yoga: 'Fitness', fitness: 'Fitness', workout: 'Fitness',
  dumbbell: 'Fitness', swimming: 'Fitness', cycling: 'Fitness', sports: 'Fitness',
  // Subscriptions
  subscription: 'Subscriptions', premium: 'Subscriptions', membership: 'Subscriptions',
  icloud: 'Subscriptions', dropbox: 'Subscriptions', 'google one': 'Subscriptions',
};

export const INCOME_KEYWORD_MAP: Record<string, string> = {
  salary: 'Salary', stipend: 'Salary', payroll: 'Salary', wages: 'Salary',
  bonus: 'Bonus', incentive: 'Bonus', reward: 'Cashback',
  gift: 'Gift', present: 'Gift',
  freelance: 'Freelance', client: 'Freelance', contract: 'Freelance', project: 'Freelance',
  dividend: 'Investment', investment: 'Investment', returns: 'Investment',
  interest: 'Investment', profit: 'Investment',
  cashback: 'Cashback', refund: 'Cashback', points: 'Cashback',
};

export const GOAL_KEYWORD_MAP: Record<string, string> = {
  // emergency
  'rainy day': 'emergency', contingency: 'emergency', emergency: 'emergency',
  backup: 'emergency', safety: 'emergency',
  // vacation
  vacation: 'vacation', holiday: 'vacation', travel: 'vacation',
  trip: 'vacation', beach: 'vacation', tour: 'vacation',
  // house
  'real estate': 'house', renovation: 'house', mortgage: 'house',
  apartment: 'house', property: 'house', house: 'house', home: 'house', flat: 'house',
  // car
  motorcycle: 'car', vehicle: 'car', bike: 'car', suv: 'car', car: 'car',
  // education
  university: 'education', education: 'education', college: 'education',
  school: 'education', tuition: 'education', course: 'education',
  degree: 'education', study: 'education', mba: 'education',
  // investment
  'mutual fund': 'investment', investment: 'investment', portfolio: 'investment',
  trading: 'investment', stocks: 'investment', crypto: 'investment',
  bonds: 'investment', sip: 'investment',
  // wedding
  honeymoon: 'wedding', engagement: 'wedding', wedding: 'wedding',
  marriage: 'wedding', bride: 'wedding', groom: 'wedding', ring: 'wedding',
  // electronics
  electronics: 'electronics', macbook: 'electronics', laptop: 'electronics',
  computer: 'electronics', iphone: 'electronics', tablet: 'electronics',
  ipad: 'electronics', gadget: 'electronics', camera: 'electronics',
  phone: 'electronics', tv: 'electronics',
};

const ICON_MAP: Record<string, string> = {
  Food: 'food-fork-drink',
  Groceries: 'cart',
  Shopping: 'shopping',
  Bills: 'file-document',
  Rent: 'home',
  Travel: 'airplane',
  Entertainment: 'movie',
  Health: 'medical-bag',
  Education: 'school',
  Fitness: 'dumbbell',
  Subscriptions: 'repeat',
  Salary: 'briefcase',
  Bonus: 'star-circle',
  Gift: 'gift',
  Freelance: 'laptop',
  Investment: 'trending-up',
  Cashback: 'cash-refund',
  Transport: 'car',
  Others: 'shape-outline',
};

export const getCategoryIcon = (category: string): string =>
  ICON_MAP[category] ?? 'shape-outline';

export const getCategoryLabel = (
  value: string,
  type: 'expense' | 'income' | 'split' = 'expense',
): string => {
  const list =
    type === 'income'
      ? INCOME_CATEGORIES
      : type === 'split'
      ? SPLIT_CATEGORIES
      : EXPENSE_CATEGORIES;
  return list.find(c => c.value === value)?.label ?? value;
};
