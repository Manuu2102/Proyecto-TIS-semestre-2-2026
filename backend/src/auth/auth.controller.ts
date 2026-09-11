import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(
    @Body() body: {
      user_name: string;
      password: string;
    },
  ) {
    return this.authService.login(
      body.user_name,
      body.password,
    );
  }
}