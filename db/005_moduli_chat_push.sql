-- BETABANDA 0.6 | Migrazione incrementale. NON cancellare lo schema 004.
-- Le politiche RLS sono applicate dal database, non dal codice del browser.
BEGIN;

-- La ricerca dei destinatari rivela solo username e ID degli account attivi.
-- Non concede accesso ad anagrafiche, email, date di nascita o ruoli.
CREATE OR REPLACE FUNCTION public.bb_find_recipients(q text)
RETURNS TABLE(id uuid, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT a.id,a.username FROM public.bb_accounts a
 WHERE auth.uid() IS NOT NULL AND a.status='active'
   AND EXISTS(SELECT 1 FROM public.bb_accounts myself WHERE myself.auth_user_id=auth.uid() AND myself.status='active')
   AND a.auth_user_id IS DISTINCT FROM auth.uid()
   AND length(btrim(q)) >= 2
   AND strpos(lower(a.username), lower(btrim(q))) > 0
 ORDER BY a.username LIMIT 30;
$$;
REVOKE ALL ON FUNCTION public.bb_find_recipients(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bb_find_recipients(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.bb_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_id uuid NOT NULL REFERENCES public.bb_accounts(id) ON DELETE RESTRICT,
 recipient_id uuid NOT NULL REFERENCES public.bb_accounts(id) ON DELETE RESTRICT,
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 10000),
 sent_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 CHECK(sender_id<>recipient_id)
);
CREATE INDEX IF NOT EXISTS bb_messages_pair ON public.bb_messages(sender_id,recipient_id,sent_at DESC);
CREATE INDEX IF NOT EXISTS bb_messages_received ON public.bb_messages(recipient_id,sent_at DESC);
ALTER TABLE public.bb_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.bb_messages TO authenticated;
DROP POLICY IF EXISTS bb_messages_read ON public.bb_messages;
CREATE POLICY bb_messages_read ON public.bb_messages FOR SELECT TO authenticated
 USING (sender_id IN (SELECT id FROM public.bb_accounts WHERE auth_user_id=auth.uid() AND status='active')
 OR recipient_id IN (SELECT id FROM public.bb_accounts WHERE auth_user_id=auth.uid() AND status='active'));
DROP POLICY IF EXISTS bb_messages_send ON public.bb_messages;
CREATE POLICY bb_messages_send ON public.bb_messages FOR INSERT TO authenticated WITH CHECK (
 sender_id IN (SELECT id FROM public.bb_accounts WHERE auth_user_id=auth.uid() AND status='active')
 AND EXISTS(SELECT 1 FROM public.bb_accounts WHERE id=recipient_id AND status='active')
 AND read_at IS NULL);
-- Non concediamo UPDATE diretto: la conferma lettura usa un RPC verificato.
REVOKE UPDATE ON public.bb_messages FROM authenticated;
CREATE OR REPLACE FUNCTION public.bb_mark_message_read(p_message uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.bb_messages SET read_at=now() WHERE id=p_message AND read_at IS NULL
 AND recipient_id IN (SELECT id FROM public.bb_accounts WHERE auth_user_id=auth.uid() AND status='active');
END; $$;
REVOKE ALL ON FUNCTION public.bb_mark_message_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bb_mark_message_read(uuid) TO authenticated;

-- I registri di lavoro sono dati di PROVA: mai pagamenti legalmente definitivi.
-- Un singolo archivio estendibile: ogni tipologia ha permessi server propri.
-- Struttura jsonb mantiene rapidi i prototipi, ma prima della produzione
-- sarà sostituita da tabelle relazionali per compensi e inventario.
CREATE TABLE IF NOT EXISTS public.bb_work_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 module text NOT NULL CHECK(module IN ('treasury','school','uniforms','projects','bookings','media','band','family')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 250),
 details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bb_work_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bb_work_items TO authenticated;
CREATE OR REPLACE FUNCTION public.bb_module_allowed(m text, writing boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE
 WHEN m='treasury' THEN public.bb_has_role('treasury') -- Master NON sostituisce tesoriere nelle operazioni economiche
 WHEN m='school' THEN public.bb_has_role('school_master') OR public.bb_has_role('teacher') OR public.bb_has_role('total_master')
 WHEN m='uniforms' THEN public.bb_has_role('uniform_manager') OR public.bb_has_role('total_master')
 WHEN m='projects' THEN public.bb_has_role('council') OR public.bb_has_role('total_master') OR public.bb_has_role('treasury')
 WHEN m='bookings' THEN public.bb_has_role('member') OR public.bb_has_role('total_master')
 WHEN m='media' THEN public.bb_has_role('media_manager') OR public.bb_has_role('total_master')
 WHEN m='band' THEN public.bb_has_role('band_manager') OR public.bb_has_role('conductor') OR public.bb_has_role('total_master')
 WHEN m='family' THEN public.bb_has_role('school_master') OR public.bb_has_role('total_master')
 ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.bb_module_allowed(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bb_module_allowed(text,boolean) TO authenticated;
DROP POLICY IF EXISTS bb_items_read ON public.bb_work_items;
CREATE POLICY bb_items_read ON public.bb_work_items FOR SELECT TO authenticated USING (public.bb_module_allowed(module));
DROP POLICY IF EXISTS bb_items_insert ON public.bb_work_items;
CREATE POLICY bb_items_insert ON public.bb_work_items FOR INSERT TO authenticated WITH CHECK(public.bb_module_allowed(module,true) AND created_by=auth.uid());
DROP POLICY IF EXISTS bb_items_update ON public.bb_work_items;
CREATE POLICY bb_items_update ON public.bb_work_items FOR UPDATE TO authenticated USING(public.bb_module_allowed(module,true)) WITH CHECK(public.bb_module_allowed(module,true));
DROP POLICY IF EXISTS bb_items_delete ON public.bb_work_items;
CREATE POLICY bb_items_delete ON public.bb_work_items FOR DELETE TO authenticated USING(public.bb_module_allowed(module,true));

-- Solo l'account che possiede il dispositivo può registrare una sottoscrizione.
CREATE TABLE IF NOT EXISTS public.bb_push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES public.bb_accounts(id) ON DELETE CASCADE,
 endpoint text UNIQUE NOT NULL,
 subscription jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bb_push_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bb_push_subscriptions TO authenticated;
DROP POLICY IF EXISTS bb_push_owner ON public.bb_push_subscriptions;
CREATE POLICY bb_push_owner ON public.bb_push_subscriptions FOR ALL TO authenticated
 USING(account_id IN (SELECT id FROM public.bb_accounts WHERE auth_user_id=auth.uid() AND status='active'))
 WITH CHECK(account_id IN (SELECT id FROM public.bb_accounts WHERE auth_user_id=auth.uid() AND status='active'));

-- Registro notifiche interno; la push esterna sarà inviata da una Edge Function.
CREATE TABLE IF NOT EXISTS public.bb_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES public.bb_accounts(id) ON DELETE CASCADE,
 title text NOT NULL,
 body text NOT NULL DEFAULT '',
 kind text NOT NULL DEFAULT 'general',
 created_at timestamptz NOT NULL DEFAULT now(),
 seen_at timestamptz
);
ALTER TABLE public.bb_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.bb_notifications TO authenticated;
DROP POLICY IF EXISTS bb_notice_own ON public.bb_notifications;
CREATE POLICY bb_notice_own ON public.bb_notifications FOR SELECT TO authenticated
 USING(recipient_id IN (SELECT id FROM public.bb_accounts WHERE auth_user_id=auth.uid() AND status='active'));
-- Notification created by trusted DB trigger, never by arbitrary client.
CREATE OR REPLACE FUNCTION public.bb_notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.bb_notifications(recipient_id,title,body,kind)
 VALUES(NEW.recipient_id,'Nuovo messaggio','Hai ricevuto un messaggio su BetaBanda','chat');
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS bb_new_message_notification ON public.bb_messages;
CREATE TRIGGER bb_new_message_notification AFTER INSERT ON public.bb_messages
FOR EACH ROW EXECUTE FUNCTION public.bb_notify_new_message();
COMMIT;
