import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina del body cualquier propiedad que no esté en el DTO
      forbidNonWhitelisted: true, // rechaza el request si vienen propiedades extra (en vez de solo ignorarlas)
      transform: true, // convierte automáticamente strings del body a los tipos del DTO (ej. "5" -> 5)
    }),
  );

  await app.listen(3001);
}
bootstrap();