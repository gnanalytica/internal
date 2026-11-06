import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent: add content_items.format, .details, .views and .clicks, which
 * the Marketing calendar and piece editor read, then give every existing piece
 * a format from its channel. Same columns `pnpm db:push` would add from
 * schema.ts; safe to run twice (the backfill only touches rows still without a
 * format). Statements run one after another — the Neon HTTP driver has no
 * transactions.
 *
 *     pnpm tsx --env-file=.env.local src/db/add-content-format.ts
 */
async function main() {
  await db.execute(sql`alter table content_items add column if not exists format text`);
  console.log("content_items.format   added");
  await db.execute(sql`alter table content_items add column if not exists details jsonb`);
  console.log("content_items.details  added");
  await db.execute(sql`alter table content_items add column if not exists views integer`);
  console.log("content_items.views    added");
  await db.execute(sql`alter table content_items add column if not exists clicks integer`);
  console.log("content_items.clicks   added");

  // Mirrors CHANNEL_FORMAT in src/lib/marketing.ts.
  const res = await db.execute(sql`
    update content_items set format = case channel
      when 'blog' then 'article'
      when 'email' then 'email'
      when 'download' then 'pdf'
      when 'linkedin' then 'post'
      when 'instagram' then 'post'
      when 'whatsapp' then 'message'
      when 'video' then 'webinar'
    end
    where format is null
      and channel in ('blog', 'email', 'download', 'linkedin', 'instagram', 'whatsapp', 'video')
  `);
  console.log(`content_items.format   backfilled (${res.rowCount ?? 0} rows)`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
