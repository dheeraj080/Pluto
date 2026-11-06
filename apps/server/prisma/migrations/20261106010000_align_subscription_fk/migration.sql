-- Prisma's default referential action for `onUpdate` is CASCADE, but the
-- plan/subscription migration created this foreign key without it. That left
-- the live database one step away from schema.prisma, which `prisma migrate
-- diff` reported as drift on every CI run.
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
