import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { FriendDto, FriendRequestDto, FriendRequestsDto, FriendshipResultDto } from './dto/friends.dto';
import { FriendsService } from './friends.service';

const uuid = new ParseUUIDPipe({ version: undefined });

@ApiTags('Friends')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @ApiOperation({ summary: 'Your friends' })
  @ApiOkResponse({ type: [FriendDto] })
  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.friends.friends(me.userId);
  }

  @ApiOperation({ summary: 'Friend requests: received (to accept / decline) and sent (waiting)' })
  @ApiOkResponse({ type: FriendRequestsDto })
  @Get('requests')
  requests(@CurrentUser() me: AuthUser) {
    return this.friends.requests(me.userId);
  }

  @ApiOperation({
    summary: 'Ask someone to be friends',
    description:
      'If they had already asked you, this accepts their request (friendship = "friends"). Asking again changes nothing.',
  })
  @ApiOkResponse({ type: FriendshipResultDto })
  @ApiBadRequestResponse({ description: 'Invalid userId, or yourself' })
  @ApiNotFoundResponse({ description: 'No such user' })
  @Post('requests')
  @HttpCode(HttpStatus.OK)
  request(@CurrentUser() me: AuthUser, @Body() body: FriendRequestDto) {
    return this.friends.request(me.userId, body.userId);
  }

  @ApiOperation({ summary: 'Accept the request this person sent you (fine if already friends)' })
  @ApiOkResponse({ type: FriendshipResultDto })
  @ApiNotFoundResponse({ description: 'This person has not sent you a request' })
  @Post('requests/:userId/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() me: AuthUser, @Param('userId', uuid) userId: string) {
    return this.friends.accept(me.userId, userId);
  }

  @ApiOperation({ summary: 'Decline a request you received, or cancel one you sent (idempotent)' })
  @ApiNoContentResponse({ description: 'No pending request between you any more' })
  @Delete('requests/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  dropRequest(@CurrentUser() me: AuthUser, @Param('userId', uuid) userId: string) {
    return this.friends.dropRequest(me.userId, userId);
  }

  @ApiOperation({ summary: 'Unfriend (idempotent)' })
  @ApiNoContentResponse({ description: 'Not friends any more' })
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfriend(@CurrentUser() me: AuthUser, @Param('userId', uuid) userId: string) {
    return this.friends.unfriend(me.userId, userId);
  }
}
