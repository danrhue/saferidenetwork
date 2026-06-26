-- Driver documents: rejection reason + flexible status constraint
-- Run in Supabase SQL Editor (production + local if applicable)

ALTER TABLE driver_documents
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE driver_documents
  DROP CONSTRAINT IF EXISTS driver_documents_status_check;

ALTER TABLE driver_documents
  ADD CONSTRAINT driver_documents_status_check
  CHECK (status IN ('uploaded', 'pending_review', 'approved', 'rejected'));