-- How each payout was actually sent. Add-only.
ALTER TABLE "AffiliateWithdrawal" ADD COLUMN "paidMethod" "PayoutMethod";
