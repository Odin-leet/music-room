import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { Friendship } from './friendship.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship])],
  controllers: [FriendsController],
  providers: [FriendsService],
  // UsersService asks it "are these two friends?" for profile visibility.
  exports: [FriendsService],
})
export class FriendsModule {}
