import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator.js';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CreateMentorAdminUseCase,
  ListMentorsAdminUseCase,
  UpdateMentorAdminUseCase,
} from '../../application/use-cases/account/admin-mentors.usecases.js';

class CreateMentorInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  areas?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured?: boolean;
}

class UpdateMentorInput {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  areas?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

@Controller('admin/mentors')
@Roles('ADMIN')
export class AdminMentorsController {
  constructor(
    private readonly listMentors: ListMentorsAdminUseCase,
    private readonly createMentor: CreateMentorAdminUseCase,
    private readonly updateMentor: UpdateMentorAdminUseCase,
  ) {}

  @Get()
  async list() {
    return this.listMentors.execute();
  }

  @Post()
  async create(
    @Body()
    input: CreateMentorInput,
  ) {
    const mentor = await this.createMentor.execute(input);
    return { mentor };
  }

  @Patch(':id')
  async update(
    @Param('id')
    id: string,
    @Body()
    input: UpdateMentorInput,
  ) {
    const mentor = await this.updateMentor.execute({ mentorId: id, data: input });
    return { mentor };
  }
}
