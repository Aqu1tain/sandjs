/**
 * Clamps a value between 0 and 1.
 * @param value - The value to clamp
 * @returns The clamped value in the range [0, 1]
 */
export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
