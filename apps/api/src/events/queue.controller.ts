import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LocationDto, SuggestTrackDto } from './dto/queue.dto';
import { QueueService } from './queue.service';

const loc = (l: LocationDto) => (l.lat !== undefined && l.lng !== undefined ? { lat: l.lat, lng: l.lng } : null);

@Controller('events/:id')
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get('queue')
  view(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.queue.queue(id, user.userId);
  }

  @Post('tracks')
  suggest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: SuggestTrackDto) {
    return this.queue.suggest(id, user.userId, body.providerTrackId, loc(body));
  }

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

  // Location as ?lat=&lng= here: request bodies on DELETE are unreliable.
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
