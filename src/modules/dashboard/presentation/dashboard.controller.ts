import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { GetDashboardUseCase } from '../application/get-dashboard.usecase.js';
@Controller('admin/dashboard')
@Roles('ADMIN')
export class DashboardController {
  constructor(private readonly getDashboard: GetDashboardUseCase) {}
  @Get()
  async get(@Query('from') from?: string, @Query('to') to?: string) {
    const current = new Date();
    const inicioAno = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
    const fimAno = new Date(
      Date.UTC(current.getUTCFullYear(), 11, 31, 23, 59, 59, 999),
    );
    const de = from ? new Date(from) : inicioAno;
    const ate = to ? new Date(to) : fimAno;
    return this.getDashboard.execute({
      current,
      from: Number.isNaN(de.getTime()) ? inicioAno : de,
      to: Number.isNaN(ate.getTime()) ? fimAno : ate,
    });
  }
}
