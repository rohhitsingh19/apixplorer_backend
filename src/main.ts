import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    // origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    exposedHeaders: 'X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset',
  });

  app.useBodyParser('json', { limit: '10mb' });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API Explorer backend running on http://localhost:${port}`);
}
void bootstrap();
