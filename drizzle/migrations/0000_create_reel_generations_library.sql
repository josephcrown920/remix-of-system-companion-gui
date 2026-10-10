CREATE TABLE public.editor_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'audio')),
  name TEXT NOT NULL DEFAULT 'Untitled generation',
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_generations TO authenticated;
GRANT ALL ON public.editor_generations TO service_role;

ALTER TABLE public.editor_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own generations"
ON public.editor_generations
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX editor_generations_owner_created_idx
ON public.editor_generations (owner_id, created_at DESC);

CREATE POLICY "Users read their own generation files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'reel-generations' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload their own generation files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reel-generations' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update their own generation files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'reel-generations' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'reel-generations' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete their own generation files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'reel-generations' AND (storage.foldername(name))[1] = auth.uid()::text);