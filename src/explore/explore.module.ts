import { Module } from '@nestjs/common';
import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';
import { CurlParserService } from './curl-parser.service';

@Module({
  controllers: [ExploreController],
  providers: [ExploreService, CurlParserService],
})
export class ExploreModule {}
