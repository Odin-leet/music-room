import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeezerService } from './deezer.service';
import { SearchTracksDto } from './dto/search-tracks.dto';

// Logged-in users only: keeps the provider's per-IP quota for our own app.
@Controller('music')
@UseGuards(JwtAuthGuard)
export class MusicController {
  constructor(private readonly deezer: DeezerService) {}

  @Get('search')
  search(@Query() query: SearchTracksDto) {
    return this.deezer.search(query.q);
  }

  @Get('tracks/:providerTrackId/preview')
  preview(@Param('providerTrackId') providerTrackId: string) {
    return this.deezer.preview(providerTrackId);
  }
}
