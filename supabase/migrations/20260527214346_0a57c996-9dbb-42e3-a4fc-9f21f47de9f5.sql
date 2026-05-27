
-- ===== Enums =====
CREATE TYPE public.app_role AS ENUM ('admin', 'attendant');
CREATE TYPE public.conversation_status AS ENUM ('bot_active', 'waiting_human', 'closed');
CREATE TYPE public.message_role AS ENUM ('user', 'assistant', 'human_agent');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'converted');

-- ===== Helper: updated_at trigger =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== User roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles read all authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ===== Auto create profile + first user becomes admin =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'attendant');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Contacts =====
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts all authenticated" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Conversations =====
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status public.conversation_status NOT NULL DEFAULT 'bot_active',
  assigned_to UUID REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conv_contact ON public.conversations(contact_id);
CREATE INDEX idx_conv_status ON public.conversations(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations all authenticated" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Messages =====
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role public.message_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages all authenticated" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Appointments =====
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  specialty TEXT,
  notes TEXT,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments all authenticated" ON public.appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Leads =====
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  interest TEXT,
  status public.lead_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads all authenticated" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Bot config (singleton) =====
CREATE TABLE public.bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt TEXT NOT NULL DEFAULT 'Você é uma assistente virtual de uma clínica médica. Seu nome é Claudia. Você é atenciosa, empática e profissional.

Seus objetivos são:
- Responder dúvidas sobre a clínica (horários, especialidades, convênios, endereço)
- Agendar consultas coletando: nome completo, data desejada, horário preferido e especialidade
- Capturar dados de novos pacientes (nome, telefone, e-mail)
- Quando não souber responder ou o paciente pedir para falar com humano, responda exatamente: TRANSFERIR_HUMANO

Dados da clínica: {clinic_data}
FAQ: {faq_data}

Seja sempre breve e cordial. Use linguagem simples e humanizada.',
  faq JSONB NOT NULL DEFAULT '[]'::jsonb,
  working_hours_start TIME NOT NULL DEFAULT '08:00',
  working_hours_end TIME NOT NULL DEFAULT '18:00',
  working_days JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  off_hours_message TEXT NOT NULL DEFAULT 'Olá! Nosso atendimento funciona de segunda a sexta, das 08h às 18h. Retornaremos sua mensagem assim que possível.',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bot_config TO authenticated;
GRANT ALL ON public.bot_config TO service_role;
ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_config all authenticated" ON public.bot_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_bot_config_updated BEFORE UPDATE ON public.bot_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.bot_config DEFAULT VALUES;

-- ===== Clinic config (singleton) =====
CREATE TABLE public.clinic_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Minha Clínica',
  address TEXT,
  phone TEXT,
  email TEXT,
  specialties JSONB NOT NULL DEFAULT '[]'::jsonb,
  insurance_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clinic_config TO authenticated;
GRANT ALL ON public.clinic_config TO service_role;
ALTER TABLE public.clinic_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic_config all authenticated" ON public.clinic_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_clinic_config_updated BEFORE UPDATE ON public.clinic_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.clinic_config DEFAULT VALUES;

-- ===== Integration config (singleton) =====
CREATE TABLE public.integration_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_api_url TEXT,
  evolution_api_key TEXT,
  instance_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.integration_config TO authenticated;
GRANT ALL ON public.integration_config TO service_role;
ALTER TABLE public.integration_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_config all authenticated" ON public.integration_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_integration_config_updated BEFORE UPDATE ON public.integration_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.integration_config DEFAULT VALUES;

-- ===== Realtime =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
