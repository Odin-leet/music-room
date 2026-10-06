import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MusicModule } from '../music/music.module';
import { User } from '../users/user.entity';
import { PlaylistMember } from './playlist-member.entity';
import { PlaylistTrack } from './playlist-track.entity';
import { PlaylistTracksController } from './playlist-tracks.controller';
import { PlaylistTracksService } from './playlist-tracks.service';
import { Playlist } from './playlist.entity';
import { PlaylistsBus } from './playlists-bus';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsGateway } from './playlists.gateway';
import { PlaylistsService } from './playlists.service';

@Module({
  imports: [TypeOrmModule.forFeature([Playlist, PlaylistMember, PlaylistTrack, User]), MusicModule, AuthModule],
  controllers: [PlaylistsController, PlaylistTracksController],
  providers: [PlaylistsService, PlaylistTracksService, PlaylistsBus, PlaylistsGateway],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
