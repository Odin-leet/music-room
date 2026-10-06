import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MusicModule } from '../music/music.module';
import { User } from '../users/user.entity';
import { PlaylistMember } from './playlist-member.entity';
import { PlaylistTrack } from './playlist-track.entity';
import { PlaylistTracksController } from './playlist-tracks.controller';
import { PlaylistTracksService } from './playlist-tracks.service';
import { Playlist } from './playlist.entity';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';

@Module({
  imports: [TypeOrmModule.forFeature([Playlist, PlaylistMember, PlaylistTrack, User]), MusicModule],
  controllers: [PlaylistsController, PlaylistTracksController],
  providers: [PlaylistsService, PlaylistTracksService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
