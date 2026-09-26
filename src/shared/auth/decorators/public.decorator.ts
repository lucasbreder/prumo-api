import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'prumo:isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
