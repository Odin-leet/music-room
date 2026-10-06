import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  AddPlaylistTrackDto,
  MovePlaylistTrackDto,
  PlaylistTrackDto,
  PlaylistTracksDto,
} from './dto/playlist-tracks.dto';
import { PlaylistTracksService } from './playlist-tracks.service';

const E404 = 'Playlist not found — also answered for private playlists you are not in';
const E403 = 'License "invited" and you are not invited (reason: not_invited)';

@ApiTags('Playlists (Playlist Editor)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
@Controller('playlists/:id/tracks')
@UseGuards(JwtAuthGuard)
export class PlaylistTracksController {
  constructor(private readonly tracks: PlaylistTracksService) {}

  @ApiOperation({ summary: "A playlist's tracks, in order" })
  @ApiOkResponse({ type: PlaylistTracksDto })
  @ApiNotFoundResponse({ description: E404 })
  @Get()
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tracks.list(id, user.userId);
  }

  @ApiOperation({ summary: 'Add a song (at the end, at the top with afterId: null, or right after afterId)' })
  @ApiCreatedResponse({ type: PlaylistTrackDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: E403 })
  @ApiNotFoundResponse({ description: `${E404}; or no such Deezer track` })
  @ApiConflictResponse({ description: 'Song already in the playlist, or afterId is no longer in it' })
  @Post()
  add(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: AddPlaylistTrackDto) {
    return this.tracks.add(id, user.userId, body.providerTrackId, body.afterId);
  }

  @ApiOperation({ summary: 'Move a track right after afterId (null = to the top)' })
  @ApiOkResponse({ type: PlaylistTrackDto })
  @ApiBadRequestResponse({ description: 'Validation failed, or afterId is the track itself' })
  @ApiForbiddenResponse({ description: E403 })
  @ApiNotFoundResponse({ description: `${E404}; or the track is not in it` })
  @ApiConflictResponse({ description: 'afterId is no longer in the playlist (reload and retry)' })
  @Patch(':trackId')
  move(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
    @Body() body: MovePlaylistTrackDto,
  ) {
    return this.tracks.move(id, trackId, user.userId, body.afterId);
  }

  @ApiOperation({ summary: 'Remove a track (idempotent)' })
  @ApiNoContentResponse({ description: 'Removed (or already gone)' })
  @ApiForbiddenResponse({ description: E403 })
  @ApiNotFoundResponse({ description: E404 })
  @Delete(':trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('trackId') trackId: string) {
    return this.tracks.remove(id, trackId, user.userId);
  }
}
