import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { GetDashboardUseCase } from '../application/get-dashboard.usecase.js';
@Controller('admin/dashboard')
@Roles('ADMIN')
export class DashboardController {
  constructor(private readonly getDashboard: GetDashboardUseCase) {}
  @Get()
  async get() {
    return this.getDashboard.execute({ current: new Date() });
  }
}
