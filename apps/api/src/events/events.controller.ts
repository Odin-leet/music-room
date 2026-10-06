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

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateEventDto) {
    return this.events.create(user.userId, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.events.list(user.userId);
  }

  // Before /:id so "join" isn't read as an event id.
  @Post('join')
  @HttpCode(HttpStatus.OK)
  joinByCode(@CurrentUser() user: AuthUser, @Body() body: JoinByCodeDto) {
    return this.events.joinByCode(body.inviteCode, user.userId);
  }

  // ?lat=&lng= (optional): lets a 'geo' event tell you whether you can vote from here.
  @Get(':id')
  view(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.events.view(id, user.userId, parseLocation(lat, lng));
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateEventDto) {
    return this.events.update(id, user.userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.events.remove(id, user.userId);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  joinPublic(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.joinPublic(id, user.userId);
  }

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
