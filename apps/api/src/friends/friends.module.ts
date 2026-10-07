import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendsBus } from './friends-bus';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { Friendship } from './friendship.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship])],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsBus],
  // UsersService asks it "are these two friends?" for profile visibility;
  // MeModule's gateway listens to the bus.
  exports: [FriendsService, FriendsBus],
})
export class FriendsModule {}
