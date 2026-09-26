export const Clock = 'CLOCK' as const;
export interface Clock {
  now(): Date;
}
