-- The profile picture that Google supplies when a customer signs in with Google. A picture the customer uploads themselves always wins over it.
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS avatar_url text;
