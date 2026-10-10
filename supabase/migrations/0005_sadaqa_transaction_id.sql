-- RevenueCat retries webhooks until it gets a 2xx, so the same gift purchase
-- can arrive more than once: the store transaction id makes recording a gift
-- idempotent (insert ... on conflict do nothing).
alter table public.sadaqa_gifts add column transaction_id text unique;
