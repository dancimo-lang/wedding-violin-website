-- 013: let a full wedding store a discount, and the travel and additional fees the app already sends.
-- NOT APPLIED. The owner runs this on the live database. Do not apply it from a preview.
--
-- The amount check still requires the total to equal package + travel + additional - discount,
-- and the retainer plus the balance to equal that total.

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_amounts_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_amounts_check CHECK (
    (
      package_fee_cents IS NULL
      AND travel_fee_cents IS NULL
      AND additional_fees_cents IS NULL
      AND discount_cents IS NULL
      AND total_cents IS NULL
      AND retainer_cents IS NULL
      AND balance_cents IS NULL
    )
    OR (
      package_fee_cents >= 0
      AND travel_fee_cents >= 0
      AND additional_fees_cents >= 0
      AND discount_cents >= 0
      AND total_cents >= 0
      AND retainer_cents >= 0
      AND balance_cents >= 0
      AND total_cents = package_fee_cents + travel_fee_cents + additional_fees_cents - discount_cents
      AND retainer_cents + balance_cents = total_cents
    )
  );
