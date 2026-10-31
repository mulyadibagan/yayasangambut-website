-- Only new Dayun sales use this namespace; historical documents are untouched.
CREATE UNIQUE INDEX IF NOT EXISTS kups_harvest_sale_reference
ON kups_documents(group_id,source_ref) WHERE source_ref LIKE 'DAYUN-SALE:%';
