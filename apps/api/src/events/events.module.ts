import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MusicModule } from '../music/music.module';
import { User } from '../users/user.entity';
import { EventMember } from './event-member.entity';
import { EventTrack } from './event-track.entity';
import { Event } from './event.entity';
import { EventsBus } from './events-bus';
import { EventsController } from './events.controller';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { Vote } from './vote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventMember, EventTrack, Vote, User]), MusicModule, AuthModule],
  controllers: [EventsController, QueueController],
  providers: [EventsService, QueueService, EventsBus, EventsGateway],
  exports: [EventsService],
})
export class EventsModule {}
