import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../../../shared/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../../../shared/auth/auth-user.types.js';
import { type Role } from '../../../../shared/domain/role.js';
import { CreateAccountUseCase } from '../../application/use-cases/account/create-account.usecase.js';
import { DefinirRoleUseCase } from '../../application/use-cases/account/account.usecases.js';
import { STUDENTS_READER } from '../../domain/repositories/user.repository.js';
import type {
  StudentsReader,
  StudentFilter,
} from '../../domain/repositories/user.repository.js';
import { userForView } from '../views/user.view.js';
import {
  pageOf,
  PagedQueryInput,
} from '../../../../shared/pagination/pagination.js';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Inject } from '@nestjs/common';
export class ListStudentsQuery extends PagedQueryInput {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
export class CreateUserAdminInput {
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
  @IsOptional()
  @IsEnum({ STUDENT: 'STUDENT', MENTOR: 'MENTOR', ADMIN: 'ADMIN' })
  role?: Role;
}
export class UpdateUserAdminInput {
  @IsOptional()
  @IsEnum({ STUDENT: 'STUDENT', MENTOR: 'MENTOR', ADMIN: 'ADMIN' })
  role?: Role;
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}
@Controller('admin/students')
@Roles('ADMIN')
export class AdminUsersController {
  constructor(
    @Inject(STUDENTS_READER)
    private readonly students: StudentsReader,
    private readonly createAccount: CreateAccountUseCase,
    private readonly definirRole: DefinirRoleUseCase,
  ) {}
  @Get()
  async list(
    @Query()
    query: ListStudentsQuery,
  ) {
    const filter: StudentFilter = {
      search: query.search,
      page: query.page,
      perPage: query.perPage,
    };
    const { rows, total } = await this.students.list(filter);
    return pageOf(rows, total, filter);
  }
  @Post()
  async create(
    @Body()
    input: CreateUserAdminInput,
  ) {
    const user = await this.createAccount.execute(input);
    return { user: userForView(user) };
  }
  @Patch(':id')
  async update(
    @Param('id')
    id: string,
    @Body()
    input: UpdateUserAdminInput,
    @CurrentUser()
    _admin: AuthUser,
  ) {
    const user = await this.definirRole.execute({ userId: id, ...input });
    return { user: userForView(user) };
  }
}
