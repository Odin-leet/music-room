import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { webOrigins } from './common/web-origins';
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

  // The web app (apps/web) calls the API from a browser page on another
  // origin: allow exactly its origins (WEB_ORIGINS). No cookies are used
  // (tokens travel in the Authorization header), so no credentials either.
  // The mobile app isn't a browser: CORS doesn't apply to it.
  app.enableCors({
    origin: webOrigins(),
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'X-Client-Platform', 'X-Client-Device', 'X-Client-Version'],
    exposedHeaders: ['Retry-After'],
    maxAge: 600,
  });

  // API docs: Swagger UI at /api-docs, raw OpenAPI JSON at /api-docs-json.
  // Request/response schemas come from the DTO classes (Nest Swagger compiler
  // plugin, see nest-cli.json); the realtime half is documented by hand.
  const config = new DocumentBuilder()
    .setTitle('Music Room API')
    .setDescription(
      [
        'REST API of Music Room (app: HOLY): accounts and profiles, friends, music search, Track Vote events and Playlist Editor playlists.',
        '',
        '**Auth:** log in with `POST /auth/login` (or a social login), then click **Authorize** and paste the `accessToken`.',
        'Access tokens last 15 minutes; get a new pair with `POST /auth/refresh`. `GET /users/:id` and `GET /users?q=` also work without a token (public info only).',
        '',
        '**Rate limits:** 300 requests a minute per user (per IP without a token); login, register, codes and password reset are stricter (see their 429). Over a limit: `429` + `Retry-After`.',
        '',
        '**Real-time** (Socket.IO namespaces `/events`, `/playlists`, `/me`): see `docs/realtime.md` in the repository.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'The accessToken from /auth/login',
    })
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

  // Optional public HTTPS address, to test on a real phone: Google / Facebook
  // send the browser back to a public URL, which `localhost` isn't on a phone.
  // Only when NGROK_DOMAIN is set (your .env), so CI and the load tests' second
  // instance never open it. See README → "Testing on a real phone".
  const domain = process.env.NGROK_DOMAIN?.trim();
  if (domain) {
    try {
      const ngrok = await import('@ngrok/ngrok');
      const listener = await ngrok.forward({ addr: port, domain, authtoken: process.env.NGROK_AUTHTOKEN?.trim() });
      console.log(`Public tunnel: ${listener.url()} -> http://localhost:${port}`);
    } catch (error) {
      console.error('ngrok tunnel not opened (the API keeps running locally):', error);
    }
  }
}
void bootstrap();
