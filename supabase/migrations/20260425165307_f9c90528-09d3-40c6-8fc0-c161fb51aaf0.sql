-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('owner', 'staff');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE POLICY "Users see roles in their workspace" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR owner_id = auth.uid() OR owner_id = public.get_owner_id(auth.uid()));

-- Staff invitations (only one staff per owner)
CREATE TABLE public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own invitation" ON public.staff_invitations
FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Studio brand settings (per owner)
CREATE TABLE public.studio_settings (
  owner_id UUID PRIMARY KEY,
  studio_name TEXT NOT NULL DEFAULT 'TRINETRA',
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read settings" ON public.studio_settings
FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR owner_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Owner manages settings" ON public.studio_settings
FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Auto-assign owner role + create settings on signup; honor invitations for staff
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invite RECORD;
BEGIN
  SELECT * INTO _invite FROM public.staff_invitations
   WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL LIMIT 1;

  IF _invite.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, owner_id, role) VALUES (NEW.id, _invite.owner_id, 'staff');
    UPDATE public.staff_invitations SET accepted_at = now() WHERE id = _invite.id;
  ELSE
    INSERT INTO public.user_roles (user_id, owner_id, role) VALUES (NEW.id, NEW.id, 'owner');
    INSERT INTO public.studio_settings (owner_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Backfill existing users as owners
INSERT INTO public.user_roles (user_id, owner_id, role)
SELECT id, id, 'owner' FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.studio_settings (owner_id)
SELECT id FROM auth.users
ON CONFLICT DO NOTHING;

-- Logo storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('studio-logos', 'studio-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Logos are public" ON storage.objects FOR SELECT USING (bucket_id = 'studio-logos');
CREATE POLICY "Owner uploads logo" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owner updates logo" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owner deletes logo" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'studio-logos' AND auth.uid()::text = (storage.foldername(name))[1]);