-- Migration 004 (staging): pre-generated Google Cloud TTS audio.
-- Run this in the STAGING Supabase project's SQL Editor. Do NOT run against
-- production until this has been tested and approved.
--
-- Also requires a PUBLIC Storage bucket named "word-audio" in this same
-- Supabase project (Storage -> New bucket -> name "word-audio" -> Public
-- bucket: ON). This migration only adds the columns that point at files in
-- that bucket; it does not create the bucket itself (the SQL Editor can't
-- create storage buckets).

alter table words add column if not exists audio_word_url text;
alter table words add column if not exists audio_sentence_url text;
