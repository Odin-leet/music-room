import type {
  FriendRequestsView,
  FriendRequestView,
  FriendshipResult,
  FriendshipState,
  FriendView,
} from '@music-room/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { UserSummaryDto } from '../../users/dto/user-responses.dto';

export class FriendRequestDto {
  /** The person to ask. @example "baaa7e88-cac5-41d3-b29d-4b3e64941eec" */
  @IsUUID()
  userId: string;
}

export class FriendshipResultDto implements FriendshipResult {
  userId: string;

  /** "friends" if they had already asked you (asking back accepts it). */
  @ApiProperty({ enum: ['none', 'friends', 'request_sent', 'request_received'] })
  friendship: FriendshipState;
}

export class FriendDto implements FriendView {
  user: UserSummaryDto;

  @ApiProperty({ format: 'date-time' })
  since: string;
}

export class FriendRequestItemDto implements FriendRequestView {
  user: UserSummaryDto;

  @ApiProperty({ format: 'date-time' })
  at: string;
}

export class FriendRequestsDto implements FriendRequestsView {
  /** Sent to you: accept or decline. */
  @ApiProperty({ type: [FriendRequestItemDto] })
  incoming: FriendRequestItemDto[];

  /** Sent by you, waiting. */
  @ApiProperty({ type: [FriendRequestItemDto] })
  sent: FriendRequestItemDto[];
}
