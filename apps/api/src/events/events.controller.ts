import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EventViewDto, InviteResultDto } from './dto/event-responses.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InviteDto, JoinByCodeDto } from './dto/event-actions.dto';
import { CreateEventDto, UpdateEventDto } from './dto/event-input.dto';
import { EventsService } from './events.service';

@ApiTags('Events (Track Vote)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @ApiOperation({ summary: 'Create an event (you become its owner; an invite code is generated)' })
  @ApiCreatedResponse({ type: EventViewDto })
  @ApiBadRequestResponse({ description: 'Validation failed, e.g. geo fields missing for license geo, or sent for another license' })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateEventDto) {
    return this.events.create(user.userId, body);
  }

  @ApiOperation({ summary: 'Public events + the events you are a member of, newest first' })
  @ApiOkResponse({ type: [EventViewDto] })
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.events.list(user.userId);
  }

  // Before /:id so "join" isn't read as an event id.
  @ApiOperation({ summary: 'Join any event with its 8-character invite code (as guest; never downgrades your role)' })
  @ApiOkResponse({ type: EventViewDto })
  @ApiNotFoundResponse({ description: 'No event with this code' })
  @Post('join')
  @HttpCode(HttpStatus.OK)
  joinByCode(@CurrentUser() user: AuthUser, @Body() body: JoinByCodeDto) {
    return this.events.joinByCode(body.inviteCode, user.userId);
  }

  // ?lat=&lng= (optional): lets a 'geo' event tell you whether you can vote from here.
  @ApiOperation({ summary: 'Event details, your role, and whether you can vote (send ?lat=&lng= for geo events)' })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lng', required: false, type: Number })
  @ApiOkResponse({ type: EventViewDto })
  @ApiNotFoundResponse({ description: 'Event not found — also answered for private events you are not in, so their existence is not revealed' })
  @Get(':id')
  view(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.events.view(id, user.userId, parseLocation(lat, lng));
  }

  @ApiOperation({ summary: 'Edit an event (owner). Switching license to geo requires all geo fields' })
  @ApiOkResponse({ type: EventViewDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Only the event owner can do this' })
  @ApiNotFoundResponse({ description: 'Event not found — also answered for private events you are not in, so their existence is not revealed' })
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateEventDto) {
    return this.events.update(id, user.userId, body);
  }

  @ApiOperation({ summary: 'Delete an event and its queue (owner)' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Only the event owner can do this' })
  @ApiNotFoundResponse({ description: 'Event not found — also answered for private events you are not in, so their existence is not revealed' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.events.remove(id, user.userId);
  }

  @ApiOperation({ summary: 'Join a public event as guest' })
  @ApiOkResponse({ type: EventViewDto })
  @ApiNotFoundResponse({ description: 'Event not found — also answered for private events you are not in, so their existence is not revealed' })
  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  joinPublic(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.joinPublic(id, user.userId);
  }

  @ApiOperation({ summary: 'Invite a registered account by email (owner). Invited accounts can vote under license invited' })
  @ApiCreatedResponse({ type: InviteResultDto })
  @ApiNotFoundResponse({ description: 'Event not found, or no account with this email' })
  @ApiForbiddenResponse({ description: 'Only the event owner can do this' })
  @Post(':id/invites')
  invite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: InviteDto) {
    return this.events.invite(id, user.userId, body.email);
  }
}

// Both or neither, and within range; anything else is ignored (= no location).
function parseLocation(lat?: string, lng?: string) {
  const la = Number(lat);
  const ln = Number(lng);
  if (lat === undefined || lng === undefined || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  return { lat: la, lng: ln };
}
