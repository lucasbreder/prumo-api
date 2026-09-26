import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
export class LoginInput {
  @IsEmail()
  email!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}
export class RefreshInput {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
export class RegisterInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
  @IsEmail()
  email!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
export class ForgotPasswordInput {
  @IsEmail()
  email!: string;
}
export class ResetPasswordInput {
  @IsString()
  @IsNotEmpty()
  token!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  newPassword!: string;
}
export class UpdateAccountInput {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
  @IsOptional()
  @IsString()
  @MaxLength(200)
  avatarKey?: string;
}
export class AvatarPresignInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameArquivo!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  contentType!: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
export class ChangePasswordInput {
  @IsString()
  @IsNotEmpty()
  passwordCurrent!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  newPassword!: string;
}
export class OAuthLoginInput {
  @IsIn(['GOOGLE', 'APPLE'])
  provider!: 'GOOGLE' | 'APPLE';
  @IsString()
  @IsNotEmpty()
  idToken!: string;
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}
