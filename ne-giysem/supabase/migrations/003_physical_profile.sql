-- Migration: 003_physical_profile
-- Adds physical profile columns to profiles table
-- and virtual model render counter

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height               integer,
  ADD COLUMN IF NOT EXISTS age                  integer,
  ADD COLUMN IF NOT EXISTS body_type            text,
  ADD COLUMN IF NOT EXISTS skin_tone            text,
  ADD COLUMN IF NOT EXISTS hair_color           text,
  ADD COLUMN IF NOT EXISTS hair_length          text,
  ADD COLUMN IF NOT EXISTS hair_type            text,
  ADD COLUMN IF NOT EXISTS virtual_model_renders integer not null default 0;
