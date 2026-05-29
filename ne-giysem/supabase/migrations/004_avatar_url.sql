-- Migration: 004_avatar_url
-- Adds avatar_url column to profiles table for virtual try-on

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;
