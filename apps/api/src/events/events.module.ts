import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { EventMember } from './event-member.entity';
import { EventTrack } from './event-track.entity';
import { Event } from './event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Vote } from './vote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventMember, EventTrack, Vote, User])],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
