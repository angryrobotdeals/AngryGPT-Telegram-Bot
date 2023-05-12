import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

require('dotenv').config();

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);
  // const app = await NestFactory.createApplicationContext(AppModule);
  // await app.listen(3000);
}

bootstrap().then();
