import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MarketplaceService } from './marketplace.service';
import { ListListingsDto } from './dto/list-listings.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('listings')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get()
  list(@Query() query: ListListingsDto) {
    return this.marketplace.list(query);
  }

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.marketplace.getBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateListingDto) {
    return this.marketplace.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/offers')
  offer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateOfferDto,
  ) {
    return this.marketplace.makeOffer(id, user.sub, dto);
  }
}
