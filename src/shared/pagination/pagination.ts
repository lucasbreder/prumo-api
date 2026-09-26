import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
export class PagedQueryInput {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  perPage = 12;
}
export const PER_PAGE_MAX = 50;
export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
export interface Page<T> {
  items: T[];
  meta: PageMeta;
}
export function pageOf<T>(
  items: T[],
  total: number,
  query: {
    page: number;
    perPage: number;
  },
): Page<T> {
  return {
    items,
    meta: {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    },
  };
}
export function skipTake(query: { page: number; perPage: number }): {
  skip: number;
  take: number;
} {
  return {
    skip: (query.page - 1) * query.perPage,
    take: Math.min(query.perPage, PER_PAGE_MAX),
  };
}
