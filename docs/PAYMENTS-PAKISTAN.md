# Payments plan: JazzCash and Easypaisa first

This is the plan for stage 2. The database tables are already in place (`Payment`, with `PaymentProvider`, `PaymentMethod` and `PaymentStatus` enums in `prisma/schema.prisma`).

> Field names, endpoints and response codes below follow the providers' public integration guides as generally documented. **Always confirm them against the merchant integration documents JazzCash and Easypaisa send you after onboarding.** These guides change between versions.

## Payment methods at launch

| Method | Provider | Why |
| --- | --- | --- |
| Mobile wallet | JazzCash (`MWALLET`) | Very large wallet user base. The customer approves on their phone. |
| Mobile account | Easypaisa (`MA`) | Same, for Telenor / Easypaisa users. |
| Debit/credit card | JazzCash or Easypaisa hosted card page | The card is entered on the provider's page, so MixPrint never handles card data (keeps PCI scope minimal). |
| Voucher / over the counter | JazzCash OTC, Easypaisa shop | For customers without a wallet. They pay cash at a retailer within the voucher's expiry. |
| Cash on delivery | — | Still a large share of Pakistani e-commerce. Can be limited by order value or city, or require an advance deposit for custom print jobs. |
| Bank transfer | — | For large B2B orders. Staff confirm manually (`PAYMENT_REVIEW` status). |

Custom printing is made to order. A common policy is **full or partial advance payment for custom jobs**, with COD only for repeat customers or below a value limit. This is a business decision for you.

## What you need from each provider

1. **Business onboarding:** CNIC, NTN / business registration, business bank account, website with refund policy, terms and contact details. JazzCash and Easypaisa both review the live site before approving.
2. **Sandbox credentials:**
   - JazzCash: Merchant ID, Password, Integrity Salt (merchant sandbox portal).
   - Easypaisa: Store ID, Hash Key, and API username/password for the REST wallet APIs.
3. **Callback URLs** registered with the provider: return URL, and IPN / notification URL, for example `https://mixprint.pk/api/payments/jazzcash/callback`.
4. **Network access in the cloud environment** to the sandbox hosts (`sandbox.jazzcash.com.pk`, `easypaystg.easypaisa.com.pk`), so integration tests can call them.

## Architecture

```
src/lib/payments/
  types.ts            PaymentGateway interface
  jazzcash.ts         request signing, MWALLET / card / OTC, status inquiry
  easypaisa.ts        hashed request, MA / card / OTC, status inquiry
  service.ts          create payment, apply callback, reconcile (provider-agnostic)
src/app/api/payments/
  jazzcash/callback/route.ts
  easypaisa/callback/route.ts   (+ IPN handler)
```

```ts
interface PaymentGateway {
  // Returns either a redirect form (hosted page) or a pending state (wallet push / voucher).
  initiate(payment: Payment, customer: { mobile?: string; email: string }): Promise<InitiateResult>;
  // Verifies the signature of a callback / IPN and maps it to our status.
  parseCallback(body: Record<string, string>): CallbackResult;
  // Server-to-server status check; the source of truth.
  inquire(txnRef: string): Promise<InquiryResult>;
}
```

### JazzCash (outline)

- **Hosted page (card / wallet / voucher):** the browser POSTs a form to the JazzCash merchant form endpoint with `pp_Version`, `pp_TxnType` (`MWALLET`, `MPAY`, `OTC`), `pp_MerchantID`, `pp_Password`, `pp_TxnRefNo`, `pp_Amount` (**paisa**), `pp_TxnCurrency=PKR`, `pp_TxnDateTime` and `pp_TxnExpiryDateTime` (`yyyyMMddHHmmss`, Pakistan time), `pp_BillReference`, `pp_Description`, `pp_ReturnURL` and `pp_SecureHash`.
- **`pp_SecureHash`:** HMAC-SHA256 keyed with the Integrity Salt. The message is the salt followed by all non-empty `pp_` values, sorted by field name and joined with `&`. Verify the same hash on every response.
- **Direct wallet API (REST):** charge a JazzCash mobile number with the customer's CNIC last 6 digits. The customer approves on their phone.
- **Status inquiry API:** call before marking an order paid, and from the reconciliation job.
- Response code `000` means success. Other codes mean pending, failed or cancelled; map them from the integration guide.

### Easypaisa (outline)

- **Hosted checkout:** two-step redirect with `storeId`, `amount`, `orderRefNum`, `postBackURL`, `paymentMethod` (`MA_PAYMENT_METHOD`, `CC_PAYMENT_METHOD`, `OTC_PAYMENT_METHOD`), expiry and `merchantHashedReq`. The hash is the sorted parameter string encrypted with the store's Hash Key (AES).
- **Direct mobile account API (REST):** initiate a charge to an Easypaisa number with Basic-auth credentials. The customer approves with their PIN.
- **IPN:** Easypaisa notifies a configured URL. Treat it only as a hint, then confirm with the **transaction inquiry API**.

## Safety rules (apply to both)

1. **Never trust the browser redirect.** A customer can fake return parameters. Verify the signature, **then** confirm with the server-to-server inquiry API before changing an order to paid.
2. **Amounts come from our database**, never from request parameters. Compare the provider's reported amount to `Payment.amountMinor`.
3. **Make callbacks idempotent.** Providers retry, so look up by the unique `txnRef` and ignore repeat transitions out of a final state.
4. **One `Payment` row per attempt.** An order can have several attempts (wallet declined, then card). The order becomes `CONFIRMED` once one succeeds.
5. **Run a reconciliation job** every few minutes for `PENDING` payments. Call inquiry, then expire unpaid vouchers and wallet requests.
6. **Store raw request and response payloads** (secrets removed) in `requestPayload` / `responsePayload` for disputes.
7. **Keep secrets in environment variables only** (`.env.example` lists them). Use separate sandbox and production credentials.
8. **Refunds** are handled through the merchant portals at first. Record them as `REFUNDED` and reverse any affiliate commission.

## Testing strategy

- Unit tests for hash generation and verification, using known test vectors from the providers' guides.
- Integration tests with a **fake gateway** that implements `PaymentGateway`. These cover success, failure, pending-then-success, duplicate callbacks, tampered signatures and amount mismatches.
- Optional sandbox tests that run only when sandbox credentials and network access are configured.
- End-to-end: checkout through to a fake payment page and back, then the order shows as paid.
