import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { MeGateway } from './me.gateway';

// Its own module (not inside FriendsModule): the gateway needs AuthModule's
// JwtService, and AuthModule -> UsersModule -> FriendsModule already, so
// FriendsModule importing AuthModule would be a cycle.
@Module({
  imports: [AuthModule, FriendsModule],
  providers: [MeGateway],
})
export class MeModule {}
