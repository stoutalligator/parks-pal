import { Plant } from '@/types';

export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function currentMonth(): number {
  return new Date().getMonth() + 1;
}

export function isInBloom(plant: Plant, month: number = currentMonth()): boolean {
  return plant.bloomMonths.includes(month);
}

/** "Mar – May", "Jun", or null for plants without flowers. */
export function bloomRange(plant: Plant): string | null {
  const months = [...plant.bloomMonths].sort((a, b) => a - b);
  if (!months.length) return null;
  const first = MONTH_ABBR[months[0] - 1];
  const last = MONTH_ABBR[months[months.length - 1] - 1];
  return first === last ? first : `${first} – ${last}`;
}
