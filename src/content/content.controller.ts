import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContentService } from './content.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get('posts')
  posts() {
    return this.content.posts();
  }

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get('posts/:slug')
  post(@Param('slug') slug: string) {
    return this.content.post(slug);
  }

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get('market/prices')
  marketPrices() {
    return this.content.marketPrices();
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('waitlist')
  @HttpCode(HttpStatus.CREATED)
  joinWaitlist(@Body() dto: JoinWaitlistDto) {
    return this.content.joinWaitlist(dto.email, dto.source);
  }
}
