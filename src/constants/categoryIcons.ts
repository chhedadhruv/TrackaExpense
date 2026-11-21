import Baby from 'lucide-react-native/icons/baby';
import BookOpen from 'lucide-react-native/icons/book-open';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Building2 from 'lucide-react-native/icons/building-2';
import Bus from 'lucide-react-native/icons/bus';
import Car from 'lucide-react-native/icons/car';
import Coffee from 'lucide-react-native/icons/coffee';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import Film from 'lucide-react-native/icons/film';
import Fuel from 'lucide-react-native/icons/fuel';
import Gamepad2 from 'lucide-react-native/icons/gamepad-2';
import Gift from 'lucide-react-native/icons/gift';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import House from 'lucide-react-native/icons/house';
import Landmark from 'lucide-react-native/icons/landmark';
import Laptop from 'lucide-react-native/icons/laptop';
import Music from 'lucide-react-native/icons/music';
import PawPrint from 'lucide-react-native/icons/paw-print';
import PiggyBank from 'lucide-react-native/icons/piggy-bank';
import Pill from 'lucide-react-native/icons/pill';
import Pizza from 'lucide-react-native/icons/pizza';
import Plane from 'lucide-react-native/icons/plane';
import Receipt from 'lucide-react-native/icons/receipt';
import Scissors from 'lucide-react-native/icons/scissors';
import Shapes from 'lucide-react-native/icons/shapes';
import Shirt from 'lucide-react-native/icons/shirt';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Star from 'lucide-react-native/icons/star';
import Tag from 'lucide-react-native/icons/tag';
import TrainFront from 'lucide-react-native/icons/train-front';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import Wallet from 'lucide-react-native/icons/wallet';
import Wifi from 'lucide-react-native/icons/wifi';
import Wrench from 'lucide-react-native/icons/wrench';
import Zap from 'lucide-react-native/icons/zap';
import type {AppIcon} from '../types/icons';

/**
 * Icons a person can give their own categories. The key is what is stored in
 * `users/{uid}/categories/{id}.icon`, so keys must never be renamed or removed (an unknown key
 * shows the default icon). New keys may be added.
 */
export const CATEGORY_ICONS: readonly {key: string; icon: AppIcon}[] = [
  {key: 'shapes', icon: Shapes},
  {key: 'tag', icon: Tag},
  {key: 'star', icon: Star},
  {key: 'coffee', icon: Coffee},
  {key: 'pizza', icon: Pizza},
  {key: 'cart', icon: ShoppingCart},
  {key: 'bag', icon: ShoppingBag},
  {key: 'shirt', icon: Shirt},
  {key: 'gift', icon: Gift},
  {key: 'home', icon: House},
  {key: 'building', icon: Building2},
  {key: 'zap', icon: Zap},
  {key: 'wifi', icon: Wifi},
  {key: 'phone', icon: Smartphone},
  {key: 'laptop', icon: Laptop},
  {key: 'wrench', icon: Wrench},
  {key: 'car', icon: Car},
  {key: 'fuel', icon: Fuel},
  {key: 'bus', icon: Bus},
  {key: 'train', icon: TrainFront},
  {key: 'plane', icon: Plane},
  {key: 'health', icon: HeartPulse},
  {key: 'pill', icon: Pill},
  {key: 'fitness', icon: Dumbbell},
  {key: 'scissors', icon: Scissors},
  {key: 'sparkles', icon: Sparkles},
  {key: 'baby', icon: Baby},
  {key: 'pet', icon: PawPrint},
  {key: 'book', icon: BookOpen},
  {key: 'education', icon: GraduationCap},
  {key: 'film', icon: Film},
  {key: 'music', icon: Music},
  {key: 'game', icon: Gamepad2},
  {key: 'work', icon: Briefcase},
  {key: 'wallet', icon: Wallet},
  {key: 'card', icon: CreditCard},
  {key: 'receipt', icon: Receipt},
  {key: 'bank', icon: Landmark},
  {key: 'savings', icon: PiggyBank},
  {key: 'coins', icon: HandCoins},
  {key: 'growth', icon: TrendingUp},
];

export const DEFAULT_CATEGORY_ICON = 'shapes';

const BY_KEY = new Map(CATEGORY_ICONS.map(i => [i.key, i.icon]));

/** The icon for a stored key; the default icon for an unknown or missing key. */
export const categoryIconFor = (key: string | null | undefined): AppIcon =>
  (key ? BY_KEY.get(key) : undefined) ?? Shapes;

export const isCategoryIconKey = (key: unknown): key is string =>
  typeof key === 'string' && BY_KEY.has(key);
