export const EXPENSE_CATEGORIES = [
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
];

export const INCOME_CATEGORIES = [
  {value: 'Salary', label: 'Salary', icon: 'briefcase'},
  {value: 'Bonus', label: 'Bonus', icon: 'star-circle'},
  {value: 'Gift', label: 'Gift', icon: 'gift'},
  {value: 'Freelance', label: 'Freelance', icon: 'laptop'},
  {value: 'Investment', label: 'Investment', icon: 'trending-up'},
  {value: 'Cashback', label: 'Cashback', icon: 'cash-refund'},
  {value: 'Others', label: 'Others', icon: 'shape-outline'},
];

export const SPLIT_CATEGORIES = [
  {value: 'Food', label: 'Food', icon: 'food-fork-drink'},
  {value: 'Shopping', label: 'Shopping', icon: 'shopping'},
  {value: 'Entertainment', label: 'Entertainment', icon: 'movie'},
  {value: 'Transport', label: 'Transport', icon: 'car'},
  {value: 'Bills', label: 'Bills', icon: 'file-document'},
  {value: 'Others', label: 'Others', icon: 'shape-outline'},
];

export const EXPENSE_KEYWORD_MAP = {
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

export const INCOME_KEYWORD_MAP = {
  salary: 'Salary', stipend: 'Salary', payroll: 'Salary', wages: 'Salary',
  bonus: 'Bonus', incentive: 'Bonus', reward: 'Cashback',
  gift: 'Gift', present: 'Gift',
  freelance: 'Freelance', client: 'Freelance', contract: 'Freelance', project: 'Freelance',
  dividend: 'Investment', investment: 'Investment', returns: 'Investment',
  interest: 'Investment', profit: 'Investment',
  cashback: 'Cashback', refund: 'Cashback', points: 'Cashback',
};

const ICON_MAP = {
  // Expense
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
  // Income
  Salary: 'briefcase',
  Bonus: 'star-circle',
  Gift: 'gift',
  Freelance: 'laptop',
  Investment: 'trending-up',
  Cashback: 'cash-refund',
  // Split
  Transport: 'car',
  // Shared
  Others: 'shape-outline',
};

export const getCategoryIcon = category => ICON_MAP[category] || 'shape-outline';

export const getCategoryLabel = (value, type = 'expense') => {
  const list =
    type === 'income'
      ? INCOME_CATEGORIES
      : type === 'split'
      ? SPLIT_CATEGORIES
      : EXPENSE_CATEGORIES;
  return list.find(c => c.value === value)?.label || value;
};
