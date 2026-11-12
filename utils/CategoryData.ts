import BadgeCheck from 'lucide-react-native/icons/badge-check';
import Briefcase from 'lucide-react-native/icons/briefcase';
import BriefcaseMedical from 'lucide-react-native/icons/briefcase-medical';
import Car from 'lucide-react-native/icons/car';
import Clapperboard from 'lucide-react-native/icons/clapperboard';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import FileText from 'lucide-react-native/icons/file-text';
import Gift from 'lucide-react-native/icons/gift';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import House from 'lucide-react-native/icons/house';
import Laptop from 'lucide-react-native/icons/laptop';
import Plane from 'lucide-react-native/icons/plane';
import Repeat from 'lucide-react-native/icons/repeat';
import Shapes from 'lucide-react-native/icons/shapes';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import Utensils from 'lucide-react-native/icons/utensils';
import type {AppIcon} from '../src/types/icons';
import type {Category} from '../src/types';

export const EXPENSE_CATEGORIES: readonly Category[] = [
  {value: 'Food', label: 'Food', icon: Utensils},
  {value: 'Groceries', label: 'Groceries', icon: ShoppingCart},
  {value: 'Shopping', label: 'Shopping', icon: ShoppingBag},
  {value: 'Bills', label: 'Bills', icon: FileText},
  {value: 'Rent', label: 'Rent', icon: House},
  {value: 'Travel', label: 'Travel', icon: Plane},
  {value: 'Entertainment', label: 'Entertainment', icon: Clapperboard},
  {value: 'Health', label: 'Health', icon: BriefcaseMedical},
  {value: 'Education', label: 'Education', icon: GraduationCap},
  {value: 'Fitness', label: 'Fitness', icon: Dumbbell},
  {value: 'Subscriptions', label: 'Subscriptions', icon: Repeat},
  {value: 'Others', label: 'Others', icon: Shapes},
] as const;

export const INCOME_CATEGORIES: readonly Category[] = [
  {value: 'Salary', label: 'Salary', icon: Briefcase},
  {value: 'Bonus', label: 'Bonus', icon: BadgeCheck},
  {value: 'Gift', label: 'Gift', icon: Gift},
  {value: 'Freelance', label: 'Freelance', icon: Laptop},
  {value: 'Investment', label: 'Investment', icon: TrendingUp},
  {value: 'Cashback', label: 'Cashback', icon: HandCoins},
  {value: 'Others', label: 'Others', icon: Shapes},
] as const;

export const SPLIT_CATEGORIES: readonly Category[] = [
  {value: 'Food', label: 'Food', icon: Utensils},
  {value: 'Shopping', label: 'Shopping', icon: ShoppingBag},
  {value: 'Entertainment', label: 'Entertainment', icon: Clapperboard},
  {value: 'Transport', label: 'Transport', icon: Car},
  {value: 'Bills', label: 'Bills', icon: FileText},
  {value: 'Others', label: 'Others', icon: Shapes},
] as const;

export const EXPENSE_KEYWORD_MAP: Record<string, string> = {
  // Food
  lunch: 'Food',
  dinner: 'Food',
  breakfast: 'Food',
  snacks: 'Food',
  snack: 'Food',
  meal: 'Food',
  meals: 'Food',
  food: 'Food',
  restaurant: 'Food',
  cafe: 'Food',
  pizza: 'Food',
  burger: 'Food',
  biryani: 'Food',
  sushi: 'Food',
  coffee: 'Food',
  zomato: 'Food',
  swiggy: 'Food',
  mcdonalds: 'Food',
  kfc: 'Food',
  subway: 'Food',
  dominos: 'Food',
  starbucks: 'Food',
  // Groceries
  grocery: 'Groceries',
  groceries: 'Groceries',
  supermarket: 'Groceries',
  vegetables: 'Groceries',
  fruits: 'Groceries',
  milk: 'Groceries',
  bread: 'Groceries',
  blinkit: 'Groceries',
  zepto: 'Groceries',
  instamart: 'Groceries',
  bigbasket: 'Groceries',
  dmart: 'Groceries',
  // Shopping
  amazon: 'Shopping',
  flipkart: 'Shopping',
  myntra: 'Shopping',
  ajio: 'Shopping',
  shopping: 'Shopping',
  clothes: 'Shopping',
  shoes: 'Shopping',
  dress: 'Shopping',
  // Bills & Utilities
  electricity: 'Bills',
  'electric bill': 'Bills',
  water: 'Bills',
  'gas bill': 'Bills',
  internet: 'Bills',
  broadband: 'Bills',
  'phone bill': 'Bills',
  utility: 'Bills',
  // Rent
  rent: 'Rent',
  'house rent': 'Rent',
  apartment: 'Rent',
  flat: 'Rent',
  pg: 'Rent',
  hostel: 'Rent',
  // Travel
  uber: 'Travel',
  ola: 'Travel',
  rapido: 'Travel',
  taxi: 'Travel',
  flight: 'Travel',
  train: 'Travel',
  bus: 'Travel',
  metro: 'Travel',
  travel: 'Travel',
  hotel: 'Travel',
  irctc: 'Travel',
  trip: 'Travel',
  // Entertainment
  netflix: 'Entertainment',
  hotstar: 'Entertainment',
  'amazon prime': 'Entertainment',
  disney: 'Entertainment',
  spotify: 'Entertainment',
  youtube: 'Entertainment',
  movie: 'Entertainment',
  cinema: 'Entertainment',
  theatre: 'Entertainment',
  concert: 'Entertainment',
  gaming: 'Entertainment',
  // Health
  doctor: 'Health',
  hospital: 'Health',
  medicine: 'Health',
  pharmacy: 'Health',
  medical: 'Health',
  clinic: 'Health',
  health: 'Health',
  dentist: 'Health',
  // Education
  school: 'Education',
  college: 'Education',
  university: 'Education',
  course: 'Education',
  tuition: 'Education',
  udemy: 'Education',
  coursera: 'Education',
  books: 'Education',
  // Fitness
  gym: 'Fitness',
  yoga: 'Fitness',
  fitness: 'Fitness',
  workout: 'Fitness',
  dumbbell: 'Fitness',
  swimming: 'Fitness',
  cycling: 'Fitness',
  sports: 'Fitness',
  // Subscriptions
  subscription: 'Subscriptions',
  premium: 'Subscriptions',
  membership: 'Subscriptions',
  icloud: 'Subscriptions',
  dropbox: 'Subscriptions',
  'google one': 'Subscriptions',
};

export const INCOME_KEYWORD_MAP: Record<string, string> = {
  salary: 'Salary',
  stipend: 'Salary',
  payroll: 'Salary',
  wages: 'Salary',
  bonus: 'Bonus',
  incentive: 'Bonus',
  reward: 'Cashback',
  gift: 'Gift',
  present: 'Gift',
  freelance: 'Freelance',
  client: 'Freelance',
  contract: 'Freelance',
  project: 'Freelance',
  dividend: 'Investment',
  investment: 'Investment',
  returns: 'Investment',
  interest: 'Investment',
  profit: 'Investment',
  cashback: 'Cashback',
  refund: 'Cashback',
  points: 'Cashback',
};

export const GOAL_KEYWORD_MAP: Record<string, string> = {
  // emergency
  'rainy day': 'emergency',
  contingency: 'emergency',
  emergency: 'emergency',
  backup: 'emergency',
  safety: 'emergency',
  // vacation
  vacation: 'vacation',
  holiday: 'vacation',
  travel: 'vacation',
  trip: 'vacation',
  beach: 'vacation',
  tour: 'vacation',
  // house
  'real estate': 'house',
  renovation: 'house',
  mortgage: 'house',
  apartment: 'house',
  property: 'house',
  house: 'house',
  home: 'house',
  flat: 'house',
  // car
  motorcycle: 'car',
  vehicle: 'car',
  bike: 'car',
  suv: 'car',
  car: 'car',
  // education
  university: 'education',
  education: 'education',
  college: 'education',
  school: 'education',
  tuition: 'education',
  course: 'education',
  degree: 'education',
  study: 'education',
  mba: 'education',
  // investment
  'mutual fund': 'investment',
  investment: 'investment',
  portfolio: 'investment',
  trading: 'investment',
  stocks: 'investment',
  crypto: 'investment',
  bonds: 'investment',
  sip: 'investment',
  // wedding
  honeymoon: 'wedding',
  engagement: 'wedding',
  wedding: 'wedding',
  marriage: 'wedding',
  bride: 'wedding',
  groom: 'wedding',
  ring: 'wedding',
  // electronics
  electronics: 'electronics',
  macbook: 'electronics',
  laptop: 'electronics',
  computer: 'electronics',
  iphone: 'electronics',
  tablet: 'electronics',
  ipad: 'electronics',
  gadget: 'electronics',
  camera: 'electronics',
  phone: 'electronics',
  tv: 'electronics',
};

const ICON_MAP: Record<string, AppIcon> = {
  Food: Utensils,
  Groceries: ShoppingCart,
  Shopping: ShoppingBag,
  Bills: FileText,
  Rent: House,
  Travel: Plane,
  Entertainment: Clapperboard,
  Health: BriefcaseMedical,
  Education: GraduationCap,
  Fitness: Dumbbell,
  Subscriptions: Repeat,
  Salary: Briefcase,
  Bonus: BadgeCheck,
  Gift: Gift,
  Freelance: Laptop,
  Investment: TrendingUp,
  Cashback: HandCoins,
  Transport: Car,
  Others: Shapes,
};

export const getCategoryIcon = (category: string): AppIcon =>
  ICON_MAP[category] ?? Shapes;

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
