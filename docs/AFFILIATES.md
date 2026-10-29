# Affiliate program

## How it works

1. **Apply**: a signed-in customer applies at `/affiliate/join` with payout details (JazzCash, Easypaisa or a Pakistani IBAN) and a short description of how they will promote MixPrint.
2. **Review**: an admin approves, rejects (with a reason) or later suspends the affiliate at `/admin/affiliates`. Turning on *auto-approve* in program settings skips review.
3. **Share**: approved affiliates get a personal link `https://<site>/r/CODE` and can build links to any product (`/r/CODE?to=/products/<slug>`).
4. **Click**: `/r/CODE` records the click and stores the code in an httpOnly `mp_ref` cookie for the *referral window*, then redirects. Repeat clicks from the same IP within 30 minutes count once. IPs are stored only as a keyed hash.
5. **Order**: when checkout places an order, it calls `createCommissionForOrder(orderId, getReferralCode())`. This links the order to the affiliate and creates a **pending** commission.
6. **Confirm**: commissions are **approved** once the order has been delivered for the *hold period* ("Approve due commissions" button, or a scheduled job calling `approveDueCommissions()`). Admins can also approve or reverse individual commissions.
7. **Withdraw**: affiliates withdraw their whole available balance once it reaches the minimum. Admins send the money, then record the transaction reference (**paid**) or reject with a reason (the balance returns).

## Rules (defaults; change them in Admin → Affiliates → Program settings)

| Rule | Default |
| --- | --- |
| Default commission | 5% |
| Referral window | 30 days, last click wins |
| Hold period after delivery | 7 days |
| Minimum withdrawal | PKR 1,000 |
| Auto-approve applicants | Off |

## Decisions made without the full spec (please confirm or change)

- **Rate precedence:** the product's own commission % (set in the product editor), otherwise the affiliate's custom rate (set per affiliate by an admin), otherwise the program default.
- **Commission base:** item totals after order-level discounts, shared across items in proportion. Delivery charges are excluded.
- **Self-referrals** earn nothing. **Suspended** affiliates' links stop earning, but they can still withdraw what they already earned.
- **Cancelled or refunded orders** reverse the commission automatically (`onOrderStatusChanged`). If it was in a pending withdrawal, the withdrawal amount is reduced. If it was already paid, it is flagged for manual recovery instead of silently changing history.
- **Withdrawals** are for the full available balance, one at a time. Payment is sent manually, since automatic JazzCash/Easypaisa disbursement needs merchant API access.
- **Attribution** is cookie-based, the standard approach. Coupon-code attribution can be added later.

## Integration points for checkout (stage 2)

```ts
import { getReferralCode } from "@/lib/affiliate/referral-cookie";
import { createCommissionForOrder, onOrderStatusChanged } from "@/lib/affiliate/service";

// after the order is created:
await createCommissionForOrder(order.id, await getReferralCode());
// whenever an order status changes:
await onOrderStatusChanged(order.id, newStatus);
```

Until checkout exists, the end-to-end test uses `tests/e2e/support/simulate-referred-order.ts`, which calls these same functions.
