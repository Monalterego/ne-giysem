-- Migration: 002_wardrobe_details
-- Adds AI-detected detail columns to wardrobe_items table

ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS item_name      text,
  ADD COLUMN IF NOT EXISTS fit            text,
  ADD COLUMN IF NOT EXISTS neckline       text,
  ADD COLUMN IF NOT EXISTS sleeve_length  text,
  ADD COLUMN IF NOT EXISTS details        jsonb DEFAULT '[]'::jsonb;
