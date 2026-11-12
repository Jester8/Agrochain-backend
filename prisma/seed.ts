/**
 * Seeds the database with the website's sample listings, journal posts and
 * market-board prices (prisma/seed-data.json). Safe to re-run: rows are
 * upserted by slug / (commodity, market).
 *
 *   npm run db:seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import data from './seed-data.json';

const prisma = new PrismaClient();

async function main() {
  for (const l of data.listings) {
    const fields = {
      title: l.title,
      localName: l.localName ?? null,
      category: l.category,
      state: l.state,
      lga: l.lga,
      price: l.price,
      unit: l.unit,
      minOrder: l.minOrder,
      available: l.available,
      grade: l.grade,
      verified: l.verified,
      harvestedOn: new Date(l.harvestedOn),
      image: l.image,
      description: l.description,
      seller: l.seller as Prisma.InputJsonValue,
      sellerName: l.seller.name,
      trace: l.trace as Prisma.InputJsonValue,
    };
    await prisma.listing.upsert({ where: { slug: l.slug }, create: { slug: l.slug, ...fields }, update: fields });
  }
  console.log(`Seeded ${data.listings.length} listings`);

  for (const p of data.posts) {
    const fields = {
      title: p.title,
      excerpt: p.excerpt,
      category: p.category,
      author: p.author,
      publishedAt: new Date(p.publishedAt),
      readMinutes: p.readMinutes,
      cover: p.cover,
      featured: 'featured' in p ? Boolean(p.featured) : false,
      body: p.body as Prisma.InputJsonValue,
    };
    await prisma.post.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...fields }, update: fields });
  }
  console.log(`Seeded ${data.posts.length} posts`);

  for (const m of data.marketPrices) {
    await prisma.marketPrice.upsert({
      where: { commodity_market: { commodity: m.commodity, market: m.market } },
      create: m,
      update: { unit: m.unit, price: m.price, change: m.change },
    });
  }
  console.log(`Seeded ${data.marketPrices.length} market prices`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
