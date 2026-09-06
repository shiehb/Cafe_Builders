# Approved Business Decisions — P0 Implementation Scope

## 1. Purpose

This document converts the business-approval items identified in the current compliance audit into an explicit implementation boundary before any BUILD work begins. It records business decisions already supplied and approved for the upcoming implementation scope only. It does not implement, and does not claim to have implemented, any change.

## 2. Source of Truth

Authoritative sources for this document:

1. `Cafe_Builders_Current_Authoritative_Business_Workflow.md` (v1.0, 2026-09-06; commit `aa62cab`)
2. `audit_current_workflow.md` (commit `fc7a32a`)

The authoritative workflow document remains the business source of truth. This document records approved implementation decisions derived from that workflow and from the current compliance audit. Where this document refers to build activities, they are approved business scope for future implementation, not evidence that implementation has occurred.

## 3. Approved Decisions

### 3.1 PayMongo Simulation

- **Decision:** Keep PayMongo simulation capability for development/testing only. Simulation must require `PAYMONGO_SIMULATION_ENABLED=true`. Simulation must never be permitted in production. Remove the customer-facing simulation control/button as part of the later implementation. Simulation must not be an alternative production payment path.
- **Approved rule:** Simulation runs only when explicitly enabled and never in production. Production must reject simulation regardless of accidental configuration. Real PayMongo remains the production payment path.
- **Implementation boundary (future P0):** Simulation endpoints must be explicitly gated; production must reject simulation even under accidental configuration; the customer-facing simulation control/button is removed.
- **Explicit non-goals:** No new payment provider. No simulated payment in production. Simulation is not a fallback for real PayMongo failure. No change to the fail-closed PayMongo webhook policy.

### 3.2 Order Payment Status / Generic Status PATCH

- **Decision:** Generic order status updates must NOT be permitted to transition an order to `PAID`. `PAID` is a payment-authority state, not a generic workflow state. Payment confirmation must use an authorized payment operation/service.
- **Approved rule:** Required lifecycle: `PENDING_PAYMENT -> PAID`. Only an authorized payment-confirmation path may perform this transition. The existing generic `PATCH` status endpoint must not remain capable of bypassing the payment gate.
- **Implementation boundary (future P0):** Constrain the generic status endpoint so it cannot establish `PAID`; ensure payment confirmation flows through the authorized payment-recording service.
- **Explicit non-goals:** No new order status values. No second payment state machine. Generic status management does not become a payment authority.

### 3.3 Promotions

- **Decision:** Support one promotion per order. Promotion eligibility and discount calculation are server-authoritative. Client-displayed promotion information must not be treated as authoritative. Promotion data must be preserved historically with the order. The approved promotion model is eligible-product based. A promotion must be validated against the products/order before the discount is applied. Invalid or ineligible promotions must not produce a discount.
- **Approved rule:** Server validates and computes the single per-order promotion against eligible products; the result is persisted historically with the order; client promotion display is informational only.
- **Implementation boundary (future P2):** Server-side promotion validation, application, and storage; eligible-product model; one promotion per order; removal of misleading hardcoded client-only promotion behavior.
- **Explicit non-goals:** No promotion stacking. No time windows, customer tiers, minimum spend, usage limits, or other rules unless already present in the authoritative sources. No client-side promotion authority. No seeding of production promotion data without separate approval.

### 3.4 Cash Payment

- **Decision:** Two supported cash workflows (customer Pay-at-Cashier and POS walk-in cash sale) must both use the same authoritative payment service. The server remains authoritative for the order total. The client cannot force `PAID` merely by sending `paymentStatus=PAID`. Cash payment confirmation requires appropriate staff authorization. Insufficient cash must be rejected. Successful payment uses the existing authoritative payment recording mechanism rather than duplicating payment-state logic. `PENDING_PAYMENT` must never go directly to `PREPARING`.
- **Approved rule:** `PAID` for cash is established only through an authorized cashier-confirmation operation that validates the tendered cash against the server-authoritative total.
- **Implementation boundary (future P1):** Authenticated cash-confirmation operation; server-side cash tender validation; support for both approved cash workflows through the authoritative payment service.
- **Explicit non-goals:** No client-forced `PAID`. No bypass of the payment service. No client-side recomputation of the order total as authoritative. No direct `PENDING_PAYMENT -> PREPARING`. Cancellation/refund remain out of scope.

### 3.5 Authoritative Product-Specific Surcharges

- **Decision:** Expose the authoritative product-specific customization surcharge to clients/POS. `ProductCustomizationOption.surcharge` is authoritative when present. It overrides `CustomizationOption.priceModifier`. The client/POS must display the same surcharge basis that the server uses for pricing. The server remains authoritative and must independently calculate the final price.
- **Approved rule:** Where a product-specific surcharge exists, it overrides the global option price modifier; clients display that same basis; the server always recalculates the final price from authoritative data.
- **Implementation boundary (future P3):** Expose authoritative product-specific surcharge to clients/POS; align client/POS display with the server's pricing basis.
- **Explicit non-goals:** No client-authoritative pricing. No removal of `priceModifier` as the fallback when no product-specific surcharge row exists. No change to server-side authoritative price calculation.

### 3.6 Staff Authorization

- **Decision:** Staff-facing order/payment/monitoring operations require authentication. Authorization must be role-appropriate. Public/customer endpoints must not provide a route to perform staff-only payment or order-management operations. Do not weaken the existing signed-session/token security model. Do not invent new roles beyond the authoritative workflow unless required by the existing role model.
- **Approved rule:** Staff-only operations are gated by role-appropriate authentication; public endpoints cannot reach staff-only operations; the existing signed-session model is preserved.
- **Implementation boundary (future P0/P4):** Protect staff-only order/payment operations (P0); login rate limiting, constant-time PIN verification, session/jti revocation improvements, and staff route protection/middleware where required (P4).
- **Explicit non-goals:** No new roles beyond those already defined in the authoritative workflow/role model. No weakening of the signed-session/token security model. No client-side-only authorization for staff operations.

### 3.7 Admin Order Monitoring

- **Decision:** Implement admin order monitoring as a list/filter monitoring interface first. Do NOT create a second KDS-style kitchen board. KDS remains the kitchen workflow interface. Admin monitoring is for visibility/management, not kitchen execution. The exact filtering fields follow the existing authoritative workflow/audit findings; do not invent an unnecessarily broad analytics system.
- **Approved rule:** Admin monitoring is a list/filter visibility and management interface; KDS remains the kitchen execution interface.
- **Implementation boundary (future P4):** Admin order monitoring list/filter interface that distinguishes unpaid (`PENDING_PAYMENT`) orders from paid/kitchen orders, per the authoritative workflow §22 and audit findings.
- **Explicit non-goals:** No replacement of KDS. No kitchen execution from admin. No broad analytics/reporting system. No new roles.

## 4. Payment State Authority

The canonical order lifecycle is:

`PENDING_PAYMENT -> PAID -> PREPARING -> READY -> COMPLETED`

State explicitly:

- `PENDING_PAYMENT` cannot transition directly to `PREPARING`.
- Generic status mutation cannot establish `PAID`.
- Payment confirmation establishes `PAID`.
- Only `PAID` orders are visible to KDS as kitchen work.

## 5. Cash Workflows

Both approved cash workflows use the same authoritative payment service, follow the same lifecycle gate (`PENDING_PAYMENT -> PAID` via authorized payment confirmation), and keep the server authoritative for the order total. `PENDING_PAYMENT` never transitions directly to `PREPARING`.

### Workflow A — Customer Pay-at-Cashier

```
CHECKOUT
   |
   v
PENDING_PAYMENT
   |
   v
authorized cashier confirmation with cash tendered
   |
   v
PAID
   |
   v
KDS visibility -> PREPARING -> READY -> COMPLETED
```

### Workflow B — POS Walk-in Cash Sale

```
Cashier creates order
   |
   v
PENDING_PAYMENT
   |
   v
cashier supplies cash tendered
   |
   v
server validates cash tendered >= authoritative order total
   |
   v
PAID
   |
   v
KDS visibility -> PREPARING -> READY -> COMPLETED
```

Rules applied to both workflows:

- The server is authoritative for the order total.
- The client cannot force `PAID` merely by sending `paymentStatus=PAID`.
- Cash payment confirmation requires appropriate staff authorization.
- Insufficient cash is rejected.
- Successful payment uses the existing authoritative payment recording mechanism/service.
- `PENDING_PAYMENT` never goes directly to `PREPARING`.

## 6. Implementation Priority

Approved future implementation priorities, listed for scope control. Only P0 is authorized as the immediate next build activity; P1–P6 are recorded future scope and are NOT authorized by this document.

**P0 — Payment and security hardening**

- simulation gating/removal of customer simulation control
- prevent generic status PATCH from setting PAID
- protect staff-only order/payment operations
- preserve fail-closed PayMongo behavior
- correct payment transition authorization

**P1 — Cashier confirmation**

- authenticated cash-confirmation operation
- server-side cash tender validation
- support both approved cash workflows
- use the authoritative payment service

**P2 — Promotions**

- server-side validation/application/storage
- eligible-product model
- one promotion per order
- remove misleading hardcoded client-only promotion behavior

**P3 — Catalog/customization correctness**

- expose authoritative product-specific surcharge
- ingredient availability gating
- base-milk hiding
- per-product alternative milk rules
- empty milk selector suppression
- systemKey protection for system-defined sugar/ice options

**P4 — Admin/auth hardening**

- admin order monitoring list/filter
- login rate limiting
- constant-time PIN verification
- session/jti revocation improvements
- actual staff route protection/middleware where required

**P5 — Test coverage**

- Add regression coverage for the approved business rules and audit findings.

**P6 — Cleanup**

- Remove obsolete static catalog fallbacks/dead wiring only where confirmed safe by the implementation audit.

## 7. Non-Goals / Scope Protection

- Cancellation/refund remains out of scope.
- No new business workflow step is being created.
- No replacement of KDS with admin monitoring.
- No speculative promotion features.
- No speculative roles.
- No production payment simulation.
- No client-side authority over pricing or payment state.

## 8. BUILD Entry Criteria

Implementation may begin only after this approval document is reviewed and committed.

The next implementation activity, after approval, is P0 BUILD only.

This document does NOT authorize P1–P6 implementation. P1–P6 are described in §6 exclusively as future priority/scope and require their own approval before implementation.

## 9. Approval Status

Status: PENDING USER APPROVAL

- Prepared from current audit: 2026-09-06
- User approval: PENDING
- Implementation authorization: NOT YET GRANTED

## 10. Change Control

Any change to these decisions requires explicit user approval before implementation.