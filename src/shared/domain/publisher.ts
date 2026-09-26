export const Events = 'EVENTOS' as const;
export interface PublicadorEvents {
  issue(name: string, payload: unknown): void;
}
