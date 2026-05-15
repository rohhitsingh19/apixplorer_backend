import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ExploreModule } from './explore/explore.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 86400000, limit: 5 }],
      storage: new ThrottlerStorageRedisService(
        process.env.REDIS_URL || 'redis://localhost:6379',
        {
          tls: process.env.REDIS_URL?.startsWith('rediss://')
            ? { rejectUnauthorized: false }
            : undefined,
        }
      ),
    }),
    ExploreModule,
  ],
})
export class AppModule { }
