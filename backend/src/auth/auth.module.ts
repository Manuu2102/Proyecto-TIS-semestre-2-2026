import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [ConfigModule, MailModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [AuthService, SupabaseService, JwtStrategy, PrismaService],
  exports: [SupabaseService, PassportModule], // ← agregado PassportModule aquí
})
export class AuthModule {}