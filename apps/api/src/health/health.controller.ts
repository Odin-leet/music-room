import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

// Unauthenticated liveness check: lets clients (and us) confirm they can
// reach the API before anything involving auth or the DB.
@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Liveness check (no auth, no database)' })
  @ApiOkResponse({ schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } })
  @Get()
  check() {
    return { status: 'ok' };
  }
}
