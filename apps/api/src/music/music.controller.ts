import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TrackPreviewDto, TrackSummaryDto } from './dto/music-responses.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeezerService } from './deezer.service';
import { SearchTracksDto } from './dto/search-tracks.dto';

// Logged-in users only: keeps the provider's per-IP quota for our own app.
@ApiTags('Music (Deezer)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
@Controller('music')
@UseGuards(JwtAuthGuard)
export class MusicController {
  constructor(private readonly deezer: DeezerService) {}

  @ApiOperation({ summary: 'Search tracks (Deezer). Results never include preview links' })
  @ApiOkResponse({ type: [TrackSummaryDto] })
  @Get('search')
  search(@Query() query: SearchTracksDto) {
    return this.deezer.search(query.q);
  }

  @ApiOperation({ summary: 'A fresh 30 s preview link (expires in ~15 min: fetch it right before playing)' })
  @ApiOkResponse({ type: TrackPreviewDto })
  @ApiNotFoundResponse({ description: 'Unknown track, or no preview' })
  @Get('tracks/:providerTrackId/preview')
  preview(@Param('providerTrackId') providerTrackId: string) {
    return this.deezer.preview(providerTrackId);
  }
}
