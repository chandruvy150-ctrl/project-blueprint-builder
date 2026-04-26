-- Add address to students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address text;

-- Batches table for one-time/batch QR registration
CREATE TABLE IF NOT EXISTS public.registration_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  is_open boolean NOT NULL DEFAULT true,
  registrations_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone
);

ALTER TABLE public.registration_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages batches"
ON public.registration_batches FOR ALL
TO authenticated
USING (owner_id = auth.uid() OR owner_id = public.get_owner_id(auth.uid()))
WITH CHECK (owner_id = auth.uid() OR owner_id = public.get_owner_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_registration_batches_owner ON public.registration_batches(owner_id);
CREATE INDEX IF NOT EXISTS idx_registration_batches_token ON public.registration_batches(token);