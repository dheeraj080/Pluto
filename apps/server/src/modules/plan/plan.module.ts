import { Module } from '@nestjs/common';
import { PlanService } from './plan.service';
import { PlanGuard } from './plan.guard';

@Module({
  providers: [PlanService, PlanGuard],
  exports: [PlanService, PlanGuard],
})
export class PlanModule {}
