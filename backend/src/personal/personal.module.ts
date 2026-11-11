import { Module } from '@nestjs/common';
import { PersonalController } from './personal.controller.js';
import { PersonalService } from './personal.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PersonalController],
  providers: [PersonalService],
})
export class PersonalModule {}