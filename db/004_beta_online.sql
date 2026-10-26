-- BETABANDA 0.5 - PRIMA BETA MULTIUTENTE
-- Eseguire UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 001
-- di bb_people, bb_accounts, bb_roles, bb_account_roles e bb_rooms.
-- Tutte le operazioni amministrative sono validate da PostgreSQL, mai dal solo browser.
BEGIN;

-- Funzione di controllo: usa auth.uid() (token verificato da Supabase).
-- SECURITY DEFINER evita una policy ricorsiva leggendo bb_account_roles.
CREATE OR REPLACE FUNCTION public.bb_has_role(p_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.bb_accounts a
  JOIN public.bb_account_roles ar ON ar.account_id=a.id
  WHERE a.auth_user_id=(SELECT auth.uid()) AND a.status='active' AND ar.role_code=p_role
 );
$$;
REVOKE ALL ON FUNCTION public.bb_has_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bb_has_role(text) TO authenticated;

-- L'iscrizione è senza flag. NON può autoattribuire ruoli.
CREATE OR REPLACE FUNCTION public.bb_register_account(p_username text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE result uuid; clean_name text := btrim(p_username);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Effettua prima il login'; END IF;
 IF length(clean_name) < 3 OR length(clean_name) > 60 OR clean_name !~ '^[[:alnum:]_.-]+$' THEN
  RAISE EXCEPTION 'Username non valido (3-60 caratteri; lettere, numeri, . _ -)';
 END IF;
 SELECT id INTO result FROM public.bb_accounts WHERE auth_user_id=auth.uid();
 IF result IS NOT NULL THEN RETURN result; END IF;
 INSERT INTO public.bb_accounts(auth_user_id,username,status)
 VALUES(auth.uid(), clean_name, 'active') RETURNING id INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.bb_register_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bb_register_account(text) TO authenticated;

-- Master: assegna/rimuove singoli flag. Il primo Master già creato via SQL.
CREATE OR REPLACE FUNCTION public.bb_set_role(p_account_id uuid, p_role text, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
BEGIN
 IF NOT public.bb_has_role('total_master') THEN RAISE EXCEPTION 'Solo il Master può cambiare i permessi'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bb_accounts WHERE id=p_account_id) THEN RAISE EXCEPTION 'Account inesistente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bb_roles WHERE code=p_role) THEN RAISE EXCEPTION 'Flag inesistente'; END IF;
 IF p_role='total_master' AND NOT p_enabled AND
  (SELECT id FROM public.bb_accounts WHERE auth_user_id=auth.uid())=p_account_id THEN
  RAISE EXCEPTION 'Non puoi rimuovere il tuo unico ruolo Master';
 END IF;
 IF p_enabled THEN
  INSERT INTO public.bb_account_roles(account_id, role_code) VALUES (p_account_id,p_role)
  ON CONFLICT DO NOTHING;
 ELSE
  DELETE FROM public.bb_account_roles WHERE account_id=p_account_id AND role_code=p_role;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.bb_set_role(uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bb_set_role(uuid,text,boolean) TO authenticated;

-- Servizi/concerti e prove con un'unica fonte per il calendario.
CREATE TABLE IF NOT EXISTS public.bb_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK(length(btrim(title))>0),
 kind text NOT NULL CHECK(kind IN ('concerto','servizio','prova','altro')),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 room_id uuid REFERENCES public.bb_rooms(id) ON DELETE SET NULL,
 notes text DEFAULT '',
 is_public boolean NOT NULL DEFAULT false,
 created_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at)
);

ALTER TABLE public.bb_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_account_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_events ENABLE ROW LEVEL SECURITY;

-- Revoca generale esistente della migrazione 001; si concedono solo
-- privilegi SQL necessari. Le policy qui sotto restringono ulteriormente.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.bb_roles TO authenticated;
GRANT SELECT ON public.bb_accounts,public.bb_account_roles TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bb_people,public.bb_rooms TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bb_events TO authenticated;
GRANT SELECT ON public.bb_events TO anon;

-- DROP POLICY rende la migrazione ripetibile per piccoli aggiornamenti.
DROP POLICY IF EXISTS bb_roles_read ON public.bb_roles;
CREATE POLICY bb_roles_read ON public.bb_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS bb_accounts_read ON public.bb_accounts;
CREATE POLICY bb_accounts_read ON public.bb_accounts FOR SELECT TO authenticated
 USING (auth_user_id=(SELECT auth.uid()) OR public.bb_has_role('total_master'));
DROP POLICY IF EXISTS bb_accounts_update_master ON public.bb_accounts;
CREATE POLICY bb_accounts_update_master ON public.bb_accounts FOR UPDATE TO authenticated
 USING (public.bb_has_role('total_master')) WITH CHECK(public.bb_has_role('total_master'));

DROP POLICY IF EXISTS bb_account_roles_read ON public.bb_account_roles;
CREATE POLICY bb_account_roles_read ON public.bb_account_roles FOR SELECT TO authenticated
 USING (account_id IN (SELECT id FROM public.bb_accounts WHERE auth_user_id=(SELECT auth.uid()))
        OR public.bb_has_role('total_master'));

-- In questa beta la modifica dell'anagrafica è concessa a Master e Soci master.
-- Il socio standard non può ancora leggere l'intera anagrafica da qui.
DROP POLICY IF EXISTS bb_people_maintain ON public.bb_people;
CREATE POLICY bb_people_maintain ON public.bb_people FOR ALL TO authenticated
 USING (public.bb_has_role('total_master') OR public.bb_has_role('members_master'))
 WITH CHECK (public.bb_has_role('total_master') OR public.bb_has_role('members_master'));

DROP POLICY IF EXISTS bb_rooms_read ON public.bb_rooms;
CREATE POLICY bb_rooms_read ON public.bb_rooms FOR SELECT TO authenticated
 USING (public.bb_has_role('total_master') OR public.bb_has_role('member')
 OR public.bb_has_role('members_master') OR public.bb_has_role('school_master')
 OR public.bb_has_role('teacher') OR public.bb_has_role('band_manager'));
DROP POLICY IF EXISTS bb_rooms_master ON public.bb_rooms;
CREATE POLICY bb_rooms_master ON public.bb_rooms FOR ALL TO authenticated
 USING (public.bb_has_role('total_master')) WITH CHECK(public.bb_has_role('total_master'));

-- Pubblico: solo concerti e servizi esplicitamente pubblicabili.
DROP POLICY IF EXISTS bb_events_public ON public.bb_events;
CREATE POLICY bb_events_public ON public.bb_events FOR SELECT TO anon, authenticated
 USING (is_public=true AND kind IN ('concerto','servizio'));
DROP POLICY IF EXISTS bb_events_internal ON public.bb_events;
CREATE POLICY bb_events_internal ON public.bb_events FOR SELECT TO authenticated
 USING (public.bb_has_role('total_master') OR public.bb_has_role('member')
        OR public.bb_has_role('band_manager') OR public.bb_has_role('conductor'));
-- Per la beta creazione/modifica eventi solo Master o Responsabile banda.
DROP POLICY IF EXISTS bb_events_edit ON public.bb_events;
CREATE POLICY bb_events_edit ON public.bb_events FOR ALL TO authenticated
 USING (public.bb_has_role('total_master') OR public.bb_has_role('band_manager'))
 WITH CHECK (public.bb_has_role('total_master') OR public.bb_has_role('band_manager'));
COMMIT;

-- Controllo rapido: numero di account presenti (solo nel SQL Editor).
SELECT count(*) AS account_totali FROM public.bb_accounts;
