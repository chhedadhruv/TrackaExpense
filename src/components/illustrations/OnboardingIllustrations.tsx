import React from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  Rect,
} from 'react-native-svg';
import {useTheme, type ThemeColors} from '../../theme';
import type {OnboardingIllustration} from '../../constants/onboardingContent';

/**
 * The onboarding scenes, drawn from the shapes of the app icon (rounded tiles, a coin with a dotted
 * ring, a rising arrow). Vector, so they stay sharp on every screen, and coloured from the theme
 * palette, so they read in light and dark. No text or currency glyph inside: the app supports many
 * currencies.
 */

interface IllustrationProps {
  size?: number;
}

const VIEWBOX = 300;

/** A coin: amber disc, a darker rim and the dotted ring from the app icon. */
const Coin = ({
  cx,
  cy,
  r,
  colors,
}: {
  cx: number;
  cy: number;
  r: number;
  colors: ThemeColors;
}) => (
  <G>
    <Circle cx={cx} cy={cy} r={r} fill={colors.warning} />
    <Circle
      cx={cx}
      cy={cy}
      r={r * 0.68}
      fill="none"
      stroke={colors.surface}
      strokeWidth={r * 0.1}
      strokeDasharray={`${r * 0.16} ${r * 0.2}`}
      strokeLinecap="round"
    />
    <Circle cx={cx} cy={cy} r={r * 0.22} fill={colors.surface} />
  </G>
);

/** Soft backdrop disc shared by the three scenes. */
const Backdrop = ({colors}: {colors: ThemeColors}) => (
  <Circle cx={150} cy={150} r={138} fill={colors.primarySoft} />
);

const Track = ({colors}: {colors: ThemeColors}) => (
  <G>
    <Backdrop colors={colors} />
    {/* The card */}
    <Rect
      x={50}
      y={70}
      width={200}
      height={150}
      rx={22}
      fill={colors.surface}
      stroke={colors.cardBorder}
      strokeWidth={2}
    />
    {/* Bars */}
    <Rect
      x={76}
      y={160}
      width={26}
      height={42}
      rx={7}
      fill={colors.primary}
      opacity={0.55}
    />
    <Rect
      x={114}
      y={138}
      width={26}
      height={64}
      rx={7}
      fill={colors.primary}
      opacity={0.8}
    />
    <Rect
      x={152}
      y={112}
      width={26}
      height={90}
      rx={7}
      fill={colors.primaryFill}
    />
    {/* Trend line and arrow head */}
    <Path
      d="M72 134 L112 112 L142 124 L198 82"
      fill="none"
      stroke={colors.income}
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M178 80 L200 80 L200 102"
      fill="none"
      stroke={colors.income}
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Lines of a list under the chart */}
    <Line
      x1={196}
      y1={150}
      x2={226}
      y2={150}
      stroke={colors.border}
      strokeWidth={6}
      strokeLinecap="round"
    />
    <Line
      x1={196}
      y1={168}
      x2={218}
      y2={168}
      stroke={colors.border}
      strokeWidth={6}
      strokeLinecap="round"
    />
    <Line
      x1={196}
      y1={186}
      x2={226}
      y2={186}
      stroke={colors.border}
      strokeWidth={6}
      strokeLinecap="round"
    />
    {/* Coin overlapping the card corner */}
    <Coin cx={222} cy={216} r={34} colors={colors} />
  </G>
);

/** A person: head and shoulders in a circle-clipped badge. */
const Person = ({
  cx,
  cy,
  fill,
  colors,
  id,
}: {
  cx: number;
  cy: number;
  fill: string;
  colors: ThemeColors;
  id: string;
}) => (
  <G>
    <Defs>
      <ClipPath id={id}>
        <Circle cx={cx} cy={cy} r={30} />
      </ClipPath>
    </Defs>
    <Circle cx={cx} cy={cy} r={32} fill={colors.surface} />
    <G clipPath={`url(#${id})`}>
      <Circle cx={cx} cy={cy} r={30} fill={fill} opacity={0.2} />
      <Circle cx={cx} cy={cy - 6} r={10} fill={fill} />
      <Path
        d={`M${cx - 24} ${cy + 34} Q${cx - 24} ${cy + 8} ${cx} ${cy + 8} Q${
          cx + 24
        } ${cy + 8} ${cx + 24} ${cy + 34} Z`}
        fill={fill}
      />
    </G>
  </G>
);

const Split = ({colors}: {colors: ThemeColors}) => (
  <G>
    <Backdrop colors={colors} />
    {/* Dashed links from the receipt to each person */}
    <Path
      d="M150 150 L74 92 M150 150 L226 92 M150 150 L150 236"
      stroke={colors.primary}
      strokeWidth={3}
      strokeDasharray="2 9"
      strokeLinecap="round"
    />
    {/* Receipt with a torn bottom edge */}
    <Path
      d="M112 82 H188 Q196 82 196 90 V208 L186 200 L176 208 L166 200 L156 208 L146 200 L136 208 L126 200 L116 208 L104 200 V90 Q104 82 112 82 Z"
      fill={colors.surface}
      stroke={colors.cardBorder}
      strokeWidth={2}
    />
    <Rect
      x={118}
      y={98}
      width={64}
      height={12}
      rx={6}
      fill={colors.primaryFill}
    />
    <Line
      x1={120}
      y1={128}
      x2={180}
      y2={128}
      stroke={colors.border}
      strokeWidth={6}
      strokeLinecap="round"
    />
    <Line
      x1={120}
      y1={146}
      x2={166}
      y2={146}
      stroke={colors.border}
      strokeWidth={6}
      strokeLinecap="round"
    />
    <Line
      x1={120}
      y1={164}
      x2={176}
      y2={164}
      stroke={colors.border}
      strokeWidth={6}
      strokeLinecap="round"
    />
    <Circle cx={150} cy={184} r={8} fill={colors.income} />
    {/* The three people */}
    <Person cx={64} cy={86} fill={colors.primaryFill} colors={colors} id="p1" />
    <Person cx={236} cy={86} fill={colors.income} colors={colors} id="p2" />
    <Person cx={150} cy={248} fill={colors.warning} colors={colors} id="p3" />
  </G>
);

const Save = ({colors}: {colors: ThemeColors}) => (
  <G>
    <Backdrop colors={colors} />
    {/* A coin dropping into the jar */}
    <Coin cx={150} cy={52} r={22} colors={colors} />
    <Path
      d="M150 80 L150 96"
      stroke={colors.warning}
      strokeWidth={4}
      strokeDasharray="1 8"
      strokeLinecap="round"
    />
    {/* Lid */}
    <Rect
      x={104}
      y={96}
      width={92}
      height={18}
      rx={8}
      fill={colors.primaryFill}
    />
    {/* Jar body */}
    <Path
      d="M110 114 H190 Q214 128 214 160 V226 Q214 252 188 252 H112 Q86 252 86 226 V160 Q86 128 110 114 Z"
      fill={colors.surface}
      stroke={colors.cardBorder}
      strokeWidth={2}
    />
    {/* Level line and shine */}
    <Path
      d="M100 160 Q100 138 116 128"
      fill="none"
      stroke={colors.primarySoft}
      strokeWidth={8}
      strokeLinecap="round"
    />
    {/* Coins in the jar */}
    <Coin cx={118} cy={228} r={22} colors={colors} />
    <Coin cx={168} cy={232} r={22} colors={colors} />
    <Coin cx={142} cy={202} r={22} colors={colors} />
    <Coin cx={186} cy={196} r={20} colors={colors} />
    {/* Goal progress bar under the jar */}
    <Rect x={96} y={268} width={108} height={10} rx={5} fill={colors.border} />
    <Rect x={96} y={268} width={74} height={10} rx={5} fill={colors.income} />
  </G>
);

const SCENES: Record<
  OnboardingIllustration,
  (props: {colors: ThemeColors}) => React.JSX.Element
> = {
  track: Track,
  split: Split,
  save: Save,
};

interface OnboardingArtProps extends IllustrationProps {
  name: OnboardingIllustration;
  label: string;
}

/** One onboarding illustration, square, sized in dp. */
const OnboardingArt = ({name, label, size = 280}: OnboardingArtProps) => {
  const {colors} = useTheme();
  const Scene = SCENES[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}>
      <Scene colors={colors} />
    </Svg>
  );
};

export default OnboardingArt;
