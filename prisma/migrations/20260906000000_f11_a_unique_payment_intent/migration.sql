-- F11-A2 — database-level payment binding uniqueness.
-- Guarantees one (non-null) paymentIntentId maps to at most one Order, so a
-- webhook/payment retrieval can never ambiguously bind a payment to multiple
-- orders. Nullable values remain allowed (Postgres allows many NULLs).
-- CreateIndex
CREATE UNIQUE INDEX "orders_paymentIntentId_key" ON "orders"("paymentIntentId");