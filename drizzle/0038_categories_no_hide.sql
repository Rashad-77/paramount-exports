-- Categories can no longer be hidden, only archived: any hidden but not archived category goes back on the website.
UPDATE product_categories SET is_active = true WHERE archived_at IS NULL AND is_active = false;
