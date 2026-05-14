import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ExploreService } from './explore.service';
import { ExploreDto } from './dto/explore.dto';

@Controller('explore')
@UseGuards(ThrottlerGuard)
export class ExploreController {
  constructor(private readonly exploreService: ExploreService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 86400000 } })
  async explore(@Body() dto: ExploreDto) {
    return this.exploreService.explore(dto);
  }
}
