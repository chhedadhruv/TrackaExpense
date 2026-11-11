/**
 * Y-axis helpers for the statistics bar chart. The axis maximum is rounded up to a "nice" number
 * so every section label is a clean value (the old 110 percent of the largest bar gave labels
 * such as 3300.0000000000005, and a month with no data gave a maximum of minus infinity).
 */

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Smallest nice axis maximum that is at least `value`, divisible into `sections` clean steps. */
export const niceAxisMax = (value: number, sections: number): number => {
  if (!Number.isFinite(value) || value <= 0 || sections < 1) {
    return sections > 0 ? sections : 1;
  }
  const rawStep = value / sections;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step =
    (NICE_STEPS.find(candidate => candidate * magnitude >= rawStep) ?? 10) *
    magnitude;
  return Math.round(step * sections * 1e6) / 1e6;
};

/** Short label for an axis value: 950, 1.2K, 25K, 3.4M. Keeps the width inside the label area. */
export const compactAxisLabel = (value: number, symbol: string): string => {
  const abs = Math.abs(value);
  const trim = (n: number) => String(Math.round(n * 10) / 10);
  let text: string;
  if (abs >= 1e9) {
    text = `${trim(abs / 1e9)}B`;
  } else if (abs >= 1e6) {
    text = `${trim(abs / 1e6)}M`;
  } else if (abs >= 1e3) {
    text = `${trim(abs / 1e3)}K`;
  } else {
    text = trim(abs);
  }
  return `${value < 0 ? '-' : ''}${symbol}${text}`;
};
