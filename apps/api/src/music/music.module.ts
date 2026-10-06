import { Module } from '@nestjs/common';
import { DeezerService } from './deezer.service';
import { MusicController } from './music.controller';

@Module({
  controllers: [MusicController],
  providers: [DeezerService],
  // Track Vote / Playlist Editor will use it to validate and fetch tracks.
  exports: [DeezerService],
})
export class MusicModule {}
