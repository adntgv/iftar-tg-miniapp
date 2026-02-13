-- Migration: Add guest_count to invitations
-- Run this in Supabase SQL Editor

-- Add guest_count column (default 1 = just the person responding)
ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 1 CHECK (guest_count >= 1 AND guest_count <= 10);

-- Update existing accepted invitations to have guest_count = 1
UPDATE invitations SET guest_count = 1 WHERE guest_count IS NULL;
