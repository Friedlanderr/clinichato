
-- Helper: ensure has_role exists with correct search_path (already does, no-op safe)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Revoke broad execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- authenticated still needs has_role for RLS evaluation
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- =========================
-- bot_config
-- =========================
DROP POLICY IF EXISTS "bot_config all authenticated" ON public.bot_config;
CREATE POLICY "bot_config read staff" ON public.bot_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'attendant'));
CREATE POLICY "bot_config write admin" ON public.bot_config
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bot_config update admin" ON public.bot_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bot_config delete admin" ON public.bot_config
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- clinic_config
-- =========================
DROP POLICY IF EXISTS "clinic_config all authenticated" ON public.clinic_config;
CREATE POLICY "clinic_config read staff" ON public.clinic_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'attendant'));
CREATE POLICY "clinic_config insert admin" ON public.clinic_config
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "clinic_config update admin" ON public.clinic_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "clinic_config delete admin" ON public.clinic_config
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- integration_config (admin only — contains API keys)
-- =========================
DROP POLICY IF EXISTS "integration_config all authenticated" ON public.integration_config;
CREATE POLICY "integration_config admin only" ON public.integration_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- contacts / leads / appointments / conversations / messages — staff only
-- =========================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts','leads','appointments','conversations','messages']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' all authenticated', t);
    EXECUTE format($f$CREATE POLICY "%s staff read" ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'attendant'))$f$, t, t);
    EXECUTE format($f$CREATE POLICY "%s staff insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'attendant'))$f$, t, t);
    EXECUTE format($f$CREATE POLICY "%s staff update" ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'attendant')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'attendant'))$f$, t, t);
    EXECUTE format($f$CREATE POLICY "%s admin delete" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'))$f$, t, t);
  END LOOP;
END $$;

-- =========================
-- profiles — self read only (admins can read all)
-- =========================
DROP POLICY IF EXISTS "profiles select all authenticated" ON public.profiles;
CREATE POLICY "profiles select self or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- =========================
-- user_roles — self read only (admins can read all)
-- =========================
DROP POLICY IF EXISTS "user_roles read all authenticated" ON public.user_roles;
CREATE POLICY "user_roles select self or admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
