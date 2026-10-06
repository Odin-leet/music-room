import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MusicModule } from '../music/music.module';
import { User } from '../users/user.entity';
import { EventMember } from './event-member.entity';
import { EventTrack } from './event-track.entity';
import { Event } from './event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { Vote } from './vote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventMember, EventTrack, Vote, User]), MusicModule],
  controllers: [EventsController, QueueController],
  providers: [EventsService, QueueService],
  exports: [EventsService],
})
export class EventsModule {}
