import { Body, Controller, Get, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUserDto, UserProfileDto, UserSummaryDto } from './dto/user-responses.dto';
import { SearchUsersDto, UpdateProfileDto } from './dto/profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalUser } from '../common/decorators/optional-user.decorator';
import { UsersService } from './users.service';

const E401 = 'Missing, invalid or expired access token';
const OPTIONAL_AUTH =
  'Works without a token (public tier only). With a valid token you see more, depending on your relation; an invalid or expired token is a 401.';
// OpenAPI for "token optional": either no security ({}) or the bearer token.
const TOKEN_OPTIONAL: Record<string, string[]>[] = [{}, { bearer: [] }];

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // `me` routes first: otherwise "me" would be taken as an :id.

  @ApiOperation({ summary: 'Your own account' })
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiUnauthorizedResponse({ description: E401 })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() authUser: AuthUser) {
    const user = await this.usersService.findById(authUser.userId);
    // The token can outlive the account (e.g. user deleted after login).
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @ApiOperation({ summary: 'Your own profile, every tier included' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: E401 })
  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  myProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.profile(user.userId, user.userId);
  }

  @ApiOperation({
    summary: 'Edit your profile: public, friends-only, private and music fields (send only what changes)',
  })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiBadRequestResponse({ description: 'Validation failed (unknown genre, more than 10 artists, bad date…)' })
  @ApiUnauthorizedResponse({ description: E401 })
  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: AuthUser, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, body);
  }

  @ApiOperation({
    summary: 'Search people by display name (public info only)',
    description: OPTIONAL_AUTH,
    security: TOKEN_OPTIONAL,
  })
  @ApiOkResponse({ type: [UserSummaryDto] })
  @ApiBadRequestResponse({ description: 'q must be 2–50 characters' })
  @ApiUnauthorizedResponse({ description: 'A token was sent but is invalid or expired' })
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  search(@OptionalUser() user: AuthUser | null, @Query() query: SearchUsersDto) {
    return this.usersService.search(query.q, user?.userId ?? null);
  }

  @ApiOperation({
    summary: "Someone's profile, showing only the tiers you may see",
    description: OPTIONAL_AUTH,
    security: TOKEN_OPTIONAL,
  })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiNotFoundResponse({ description: 'No such user' })
  @ApiUnauthorizedResponse({ description: 'A token was sent but is invalid or expired' })
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  profile(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.usersService.profile(id, user?.userId ?? null);
  }
}
