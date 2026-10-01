-- Migration 004b (staging): allow the app to upload into the "word-audio"
-- Storage bucket created for migration_004_audio.sql.
--
-- Making a bucket "Public" in the Supabase dashboard only adds a read (SELECT)
-- policy, so visitors can play the files back. It does NOT allow the app's
-- anon/publishable key to upload (INSERT) or overwrite (UPDATE) files, which
-- is what generateAndStoreWordAudio() needs to do. This app already runs
-- with no login system and RLS off on its own tables (private household app),
-- so it's consistent to allow the same anon key to manage this one bucket's
-- files too — nothing in it is sensitive, it's just word-pronunciation audio.
--
-- Run this in the STAGING Supabase project's SQL Editor, after creating the
-- "word-audio" bucket (Storage -> New bucket -> public).

create policy "word-audio: anyone can upload"
on storage.objects for insert
with check ( bucket_id = 'word-audio' );

create policy "word-audio: anyone can overwrite"
on storage.objects for update
using ( bucket_id = 'word-audio' )
with check ( bucket_id = 'word-audio' );
