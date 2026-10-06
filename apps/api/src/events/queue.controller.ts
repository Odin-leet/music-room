import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { QueueBroadcastDto, QueueViewDto, QueueTrackDto, VoteResultDto } from './dto/event-responses.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LocationDto, NextTrackDto, SuggestTrackDto } from './dto/queue.dto';
import { QueueService } from './queue.service';

const loc = (l: LocationDto) => (l.lat !== undefined && l.lng !== undefined ? { lat: l.lat, lng: l.lng } : null);

@ApiTags('Queue (Track Vote)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
@Controller('events/:id')
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @ApiOperation({ summary: 'Now playing + the ranked queue (score DESC, earliest suggestion first), with votedByMe' })
  @ApiOkResponse({ type: QueueViewDto })
  @ApiNotFoundResponse({ description: 'Event not found — also answered for private events you are not in, so their existence is not revealed' })
  @Get('queue')
  view(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.queue.queue(id, user.userId);
  }

  @ApiOperation({ summary: 'Suggest a track by its Deezer id (the server fetches the details itself)' })
  @ApiCreatedResponse({ type: QueueTrackDto })
  @ApiConflictResponse({ description: 'This track is already in the queue' })
  @ApiNotFoundResponse({ description: 'Event or Deezer track not found' })
  @ApiForbiddenResponse({ description: 'Not allowed to vote/suggest. Body has a machine-readable `reason`: not_invited | not_started | ended | location_required | outside_area' })
  @Post('tracks')
  suggest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: SuggestTrackDto) {
    return this.queue.suggest(id, user.userId, body.providerTrackId, loc(body));
  }

  @ApiOperation({ summary: 'Vote for a queued track (idempotent: voting twice changes nothing)' })
  @ApiOkResponse({ type: VoteResultDto })
  @ApiConflictResponse({ description: 'The track is no longer queued (playing or played)' })
  @ApiNotFoundResponse({ description: 'Event or track not found' })
  @ApiForbiddenResponse({ description: 'Not allowed to vote/suggest. Body has a machine-readable `reason`: not_invited | not_started | ended | location_required | outside_area' })
  @Post('tracks/:trackId/vote')
  @HttpCode(HttpStatus.OK)
  vote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
    @Body() body: LocationDto,
  ) {
    return this.queue.vote(id, trackId, user.userId, loc(body));
  }

  // Owner only: playing -> played, top of the queue -> playing.
  @ApiOperation({ summary: 'Owner: the playing track becomes played, the top of the queue starts playing. A stale currentTrackId does nothing' })
  @ApiOkResponse({ type: QueueBroadcastDto })
  @ApiForbiddenResponse({ description: 'Only the event owner controls playback' })
  @ApiNotFoundResponse({ description: 'Event not found — also answered for private events you are not in, so their existence is not revealed' })
  @Post('next')
  @HttpCode(HttpStatus.OK)
  next(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: NextTrackDto) {
    return this.queue.next(id, user.userId, body.currentTrackId);
  }

  // Location as ?lat=&lng= here: request bodies on DELETE are unreliable.
  @ApiOperation({ summary: 'Remove your vote (idempotent). Geo events: location as ?lat=&lng=' })
  @ApiOkResponse({ type: VoteResultDto })
  @ApiConflictResponse({ description: 'The track is no longer queued' })
  @ApiNotFoundResponse({ description: 'Event or track not found' })
  @ApiForbiddenResponse({ description: 'Not allowed to vote/suggest. Body has a machine-readable `reason`: not_invited | not_started | ended | location_required | outside_area' })
  @Delete('tracks/:trackId/vote')
  unvote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
    @Query() query: LocationDto,
  ) {
    return this.queue.unvote(id, trackId, user.userId, loc(query));
  }
}
