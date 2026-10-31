-- 011: allow the Private Event agreement (template 'private-event', package 'EVENT').
-- Its performance fee is entered by the admin, so any positive amount is allowed.
-- NOT YET APPLIED. Run it before sending the first private event agreement.

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_template_package_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_template_package_check CHECK (
    template_id IS NULL
    OR package_id IS NULL
    OR (template_id = 'full-wedding' AND package_id = 'FULL')
    OR (template_id = 'wedding-music' AND package_id IN ('A', 'B', 'C', 'D'))
    OR (template_id = 'private-event' AND package_id = 'EVENT')
  );

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_package_fee_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_package_fee_check CHECK (
    package_id IS NULL
    OR package_fee_cents IS NULL
    OR (package_id = 'A' AND package_fee_cents = 45000)
    OR (package_id = 'B' AND package_fee_cents = 100000)
    OR (package_id = 'C' AND package_fee_cents = 100000)
    OR (package_id = 'D' AND package_fee_cents = 150000)
    OR (package_id = 'FULL' AND package_fee_cents = 300000)
    OR (package_id = 'EVENT' AND package_fee_cents > 0)
  );
