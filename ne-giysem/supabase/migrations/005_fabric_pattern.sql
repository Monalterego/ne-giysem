-- Migration: 005_fabric_pattern
-- Ensures fabric column exists and adds pattern column to wardrobe_items

ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS fabric  text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS pattern text;
