import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Post } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { waitlistWelcomeEmail } from '../mail/transactional-templates';

function toPostResponse(p: Post) {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    author: p.author,
    publishedAt: p.publishedAt.toISOString().slice(0, 10),
    readMinutes: p.readMinutes,
    cover: p.cover,
    featured: p.featured,
    body: p.body,
  };
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async posts() {
    const posts = await this.prisma.post.findMany({ where: { published: true }, orderBy: { publishedAt: 'desc' } });
    return posts.map(toPostResponse);
  }

  async post(slug: string) {
    const post = await this.prisma.post.findFirst({ where: { slug, published: true } });
    if (!post) throw new NotFoundException('Post not found.');
    return toPostResponse(post);
  }

  async marketPrices() {
    const prices = await this.prisma.marketPrice.findMany({ orderBy: { id: 'asc' } });
    return prices.map(({ commodity, market, unit, price, change }) => ({ commodity, market, unit, price, change }));
  }

  async joinWaitlist(email: string, source = 'site') {
    const existing = await this.prisma.waitlistEntry.findUnique({ where: { email } });
    if (!existing) {
      await this.prisma.waitlistEntry.create({ data: { email, source } });
      await this.mail.addContact(email, { SOURCE: source });
      try {
        await this.mail.send({ to: { email }, ...waitlistWelcomeEmail(this.config.get<string>('appUrl')!), tags: ['waitlist'] });
      } catch (error) {
        this.logger.error(`Waitlist email failed: ${String(error)}`);
      }
    }
    // Same response for new and existing sign-ups.
    return { success: true };
  }
}
