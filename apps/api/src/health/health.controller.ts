import { Controller, Get } from '@nestjs/common';

// Unauthenticated liveness check: lets clients (and us) confirm they can
// reach the API before anything involving auth or the DB.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
