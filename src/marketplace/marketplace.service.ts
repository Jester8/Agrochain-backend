import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Listing, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { offerReceiptEmail, offerToSellerEmail } from '../mail/transactional-templates';
import { ListListingsDto } from './dto/list-listings.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateListingDto } from './dto/create-listing.dto';

/** Shape the website expects (see the website's lib/data/listings.ts). */
function toListingResponse(l: Listing) {
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    localName: l.localName ?? undefined,
    category: l.category,
    state: l.state,
    lga: l.lga,
    price: l.price,
    unit: l.unit,
    minOrder: l.minOrder,
    available: l.available,
    grade: l.grade,
    verified: l.verified,
    harvestedOn: l.harvestedOn.toISOString().slice(0, 10),
    image: l.image,
    description: l.description,
    seller: l.seller,
    trace: l.trace,
  };
}

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async list(query: ListListingsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const q = query.q?.trim();

    const where: Prisma.ListingWhereInput = {
      status: 'active',
      ...(query.category && { category: query.category }),
      ...(query.state && { state: query.state }),
      ...(query.verified === 'true' && { verified: true }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { localName: { contains: q, mode: 'insensitive' } },
          { state: { contains: q, mode: 'insensitive' } },
          { lga: { contains: q, mode: 'insensitive' } },
          { sellerName: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.ListingOrderByWithRelationInput[] =
      query.sort === 'price-asc'
        ? [{ price: 'asc' }]
        : query.sort === 'price-desc'
          ? [{ price: 'desc' }]
          : [{ harvestedOn: 'desc' }, { createdAt: 'desc' }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
      this.prisma.listing.count({ where }),
    ]);

    return { items: items.map(toListingResponse), total, page, pageSize: limit };
  }

  async getBySlug(slug: string) {
    const listing = await this.prisma.listing.findFirst({ where: { slug, status: 'active' } });
    if (!listing) throw new NotFoundException('Listing not found.');
    return toListingResponse(listing);
  }

  async create(userId: string, dto: CreateListingDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    if (!user.isVerified) throw new ForbiddenException('Please verify your email first.');
    if (user.role === 'buyer') {
      throw new ForbiddenException('Only farmers, cooperatives and aggregators can list produce.');
    }

    const base = `${dto.title}-${dto.lga}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const listing = await this.prisma.listing.create({
      data: {
        slug: `${base}-${randomBytes(3).toString('hex')}`,
        title: dto.title,
        localName: dto.localName,
        category: dto.category,
        state: dto.state,
        lga: dto.lga,
        price: dto.price,
        unit: dto.unit,
        minOrder: dto.minOrder,
        available: dto.available,
        grade: dto.grade,
        harvestedOn: new Date(dto.harvestedOn),
        description: dto.description ?? '',
        sellerId: user.id,
        sellerName: `${user.firstName} ${user.lastName}`,
        seller: {
          name: `${user.firstName} ${user.lastName}`,
          type: user.role === 'cooperative' ? 'Cooperative' : user.role === 'aggregator' ? 'Aggregator' : 'Farmer',
          since: new Date().getFullYear(),
          rating: 0,
          trades: 0,
          verified: false,
        },
        trace: [{ label: 'Listed by seller', date: new Date().toISOString().slice(0, 10), place: `${dto.lga}, ${dto.state}` }],
      },
    });
    return toListingResponse(listing);
  }

  async makeOffer(listingId: string, buyerId: string, dto: CreateOfferDto) {
    const [listing, buyer] = await Promise.all([
      this.prisma.listing.findFirst({ where: { id: listingId, status: 'active' }, include: { sellerUser: true } }),
      this.prisma.user.findUnique({ where: { id: buyerId } }),
    ]);
    if (!listing) throw new NotFoundException('This listing is no longer available.');
    if (!buyer) throw new NotFoundException('Account not found.');
    if (!buyer.isVerified) throw new ForbiddenException('Please verify your email first.');
    if (listing.sellerId === buyer.id) throw new BadRequestException("You can't make an offer on your own listing.");
    if (dto.quantity < listing.minOrder) {
      throw new BadRequestException(`The minimum order is ${listing.minOrder} x ${listing.unit}.`);
    }
    if (dto.quantity > listing.available) {
      throw new BadRequestException(`Only ${listing.available} x ${listing.unit} available.`);
    }

    const offer = await this.prisma.offer.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: dto.quantity,
        pricePerUnit: dto.pricePerUnit,
        message: dto.message?.trim() ?? '',
      },
    });

    const appUrl = this.config.get<string>('appUrl');
    const info = {
      listingTitle: listing.title,
      listingUrl: `${appUrl}/marketplace/${listing.slug}`,
      unit: listing.unit,
      quantity: dto.quantity,
      pricePerUnit: dto.pricePerUnit,
      message: offer.message,
      buyerName: `${buyer.firstName} ${buyer.lastName}`,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,
    };

    // Sample listings have no seller account yet, so their offers go to the ops inbox.
    const sellerTo = listing.sellerUser
      ? { email: listing.sellerUser.email, name: `${listing.sellerUser.firstName} ${listing.sellerUser.lastName}` }
      : { email: this.config.get<string>('mail.opsEmail')!, name: 'AgroChain Ops' };

    // The offer is saved either way; an email failure shouldn't fail the request.
    const results = await Promise.allSettled([
      this.mail.send({ to: sellerTo, ...offerToSellerEmail(info), tags: ['offer'] }),
      this.mail.send({ to: { email: buyer.email, name: info.buyerName }, ...offerReceiptEmail(info), tags: ['offer-receipt'] }),
    ]);
    results.forEach((r) => r.status === 'rejected' && this.logger.error(`Offer email failed: ${String(r.reason)}`));

    return { id: offer.id, status: offer.status };
  }
}
