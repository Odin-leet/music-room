import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { InviteDto, JoinByCodeDto } from '../events/dto/event-actions.dto';
import { InviteResultDto } from '../events/dto/event-responses.dto';
import { CreatePlaylistDto, UpdatePlaylistDto } from './dto/playlist-input.dto';
import { PlaylistViewDto } from './dto/playlist-responses.dto';
import { PlaylistsService } from './playlists.service';

const E404 = 'Playlist not found — also answered for private playlists you are not in';

@ApiTags('Playlists (Playlist Editor)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
@Controller('playlists')
@UseGuards(JwtAuthGuard)
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  @ApiOperation({ summary: 'Create a playlist (you become its owner; an invite code is generated)' })
  @ApiCreatedResponse({ type: PlaylistViewDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreatePlaylistDto) {
    return this.playlists.create(user.userId, body);
  }

  @ApiOperation({ summary: 'Public playlists + the playlists you are a member of, most recently edited first' })
  @ApiOkResponse({ type: [PlaylistViewDto] })
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.playlists.list(user.userId);
  }

  // Before /:id so "join" isn't read as a playlist id.
  @ApiOperation({ summary: 'Join any playlist with its 8-character invite code (as guest)' })
  @ApiOkResponse({ type: PlaylistViewDto })
  @ApiNotFoundResponse({ description: 'No playlist with this code' })
  @Post('join')
  @HttpCode(HttpStatus.OK)
  joinByCode(@CurrentUser() user: AuthUser, @Body() body: JoinByCodeDto) {
    return this.playlists.joinByCode(body.inviteCode, user.userId);
  }

  @ApiOperation({ summary: 'Playlist details, your role, and whether you can edit' })
  @ApiOkResponse({ type: PlaylistViewDto })
  @ApiNotFoundResponse({ description: E404 })
  @Get(':id')
  view(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.playlists.view(id, user.userId);
  }

  @ApiOperation({ summary: 'Edit name / description / visibility / license (owner)' })
  @ApiOkResponse({ type: PlaylistViewDto })
  @ApiForbiddenResponse({ description: 'Only the playlist owner can do this' })
  @ApiNotFoundResponse({ description: E404 })
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdatePlaylistDto) {
    return this.playlists.update(id, user.userId, body);
  }

  @ApiOperation({ summary: 'Delete a playlist and its tracks (owner)' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Only the playlist owner can do this' })
  @ApiNotFoundResponse({ description: E404 })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.playlists.remove(id, user.userId);
  }

  @ApiOperation({ summary: 'Join a public playlist as guest' })
  @ApiOkResponse({ type: PlaylistViewDto })
  @ApiNotFoundResponse({ description: E404 })
  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  joinPublic(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.playlists.joinPublic(id, user.userId);
  }

  @ApiOperation({ summary: 'Invite a registered account by email (owner); invited accounts can edit under license invited' })
  @ApiCreatedResponse({ type: InviteResultDto })
  @ApiForbiddenResponse({ description: 'Only the playlist owner can do this' })
  @ApiNotFoundResponse({ description: 'Playlist not found, or no account with this email' })
  @Post(':id/invites')
  invite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: InviteDto) {
    return this.playlists.invite(id, user.userId, body.email);
  }
}
