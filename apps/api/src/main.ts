import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // API docs: Swagger UI at /api-docs, raw OpenAPI JSON at /api-docs-json.
  // Request/response schemas come from the DTO classes (Nest Swagger compiler
  // plugin, see nest-cli.json); the realtime half is documented by hand.
  const config = new DocumentBuilder()
    .setTitle('Music Room API')
    .setDescription(
      [
        'REST API of Music Room (Track Vote events, accounts, music search).',
        '',
        '**Auth:** log in with `POST /auth/login` (or a social login), then click **Authorize** and paste the `accessToken`.',
        'Access tokens last 15 minutes; get a new pair with `POST /auth/refresh`.',
        '',
        '**Real-time** (Socket.IO namespace `/events`): see `docs/realtime.md` in the repository.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'The accessToken from /auth/login' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    // Keep the pasted token across page reloads.
    swaggerOptions: { persistAuthorization: true },
  });

  // API_PORT from .env; a value set on the command line wins, so a second
  // instance can run next to the dev one (e.g. API_PORT=3100 for load tests).
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`API is running on http://localhost:${port}`);
}
void bootstrap();
