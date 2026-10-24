-- BetaBanda — schema iniziale di progettazione PostgreSQL 15+
-- NON distribuire direttamente in produzione: migrazioni, RLS, autenticazione
-- e procedure di pagamento vanno prima completate e verificate.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE app_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE people (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), first_name text NOT NULL, last_name text NOT NULL,
 birth_date date, address_text text, phone text, email text, photo_object_key text,
 created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid UNIQUE REFERENCES people(id),
 username text NOT NULL UNIQUE, state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','active','suspended','rejected')),
 credential_subject text UNIQUE, password_reset_required boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz, approved_by uuid REFERENCES users(id)
);
CREATE TABLE role_definitions (role_key text PRIMARY KEY, display_name text NOT NULL);
INSERT INTO role_definitions(role_key,display_name) VALUES
 ('treasury','Tesoreria'),('council','Consiglio direttivo'),('teacher','Scuola di musica - Insegnanti'),
 ('student','Scuola di musica - Alunno'),('school_master','Scuola di musica - Master'),
 ('super_master','Master totale'),('members_master','Soci master'),('member','Socio standard'),
 ('musician','Socio musicante'),('guest_musician','Musicante esterno'),('conductor','Maestro'),
 ('band_manager','Responsabile banda'),('media','Responsabile media');
CREATE TABLE user_roles (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role_key text NOT NULL REFERENCES role_definitions(role_key),
 granted_by uuid REFERENCES users(id), granted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,role_key)
);
CREATE TABLE association_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),person_id uuid NOT NULL REFERENCES people(id),
 joined_on date NOT NULL, ended_on date, end_reason text,
 UNIQUE(person_id,joined_on)
);
CREATE TABLE membership_years (
 year integer PRIMARY KEY CHECK (year BETWEEN 2000 AND 9999), fee_default numeric(12,2) NOT NULL DEFAULT 20,
 payment_deadline date, closes_on date, state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed'))
);
CREATE TABLE membership_year_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), membership_id uuid NOT NULL REFERENCES association_memberships(id),
 year integer NOT NULL REFERENCES membership_years(year),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','lapsed','readmission_pending','ended')),
 active_from date, active_to date, approved_by uuid REFERENCES users(id),
 UNIQUE(membership_id,year)
);
CREATE TABLE membership_fees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), year_record_id uuid NOT NULL UNIQUE REFERENCES membership_year_records(id),
 amount numeric(12,2) NOT NULL CHECK(amount>=0), method text NOT NULL CHECK(method IN ('cash','paypal','other')),
 paid_at timestamptz NOT NULL, received_by uuid REFERENCES users(id), transaction_reference text UNIQUE
);
CREATE TABLE member_keys (
 membership_id uuid NOT NULL REFERENCES association_memberships(id),key_type text NOT NULL CHECK(key_type IN ('headquarters','archive','upper_floor')),
 since_date date NOT NULL,returned_on date,PRIMARY KEY(membership_id,key_type,since_date)
);
CREATE TABLE rooms (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL UNIQUE,description text,active boolean NOT NULL DEFAULT true);
CREATE TABLE calendar_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind IN ('lesson','rehearsal','concert','service','association','room_booking','party','other')),
 title text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL, location_text text,
 room_id uuid REFERENCES rooms(id),created_by uuid REFERENCES users(id),public_event boolean NOT NULL DEFAULT false,
 recurrence_group uuid, CHECK(ends_at>starts_at)
);
CREATE TABLE event_participants (
 event_id uuid NOT NULL REFERENCES calendar_events(id), person_id uuid NOT NULL REFERENCES people(id),
 attendance text CHECK(attendance IN ('present','absent','unknown')) DEFAULT 'unknown',
 PRIMARY KEY(event_id,person_id)
);
CREATE TABLE room_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL UNIQUE REFERENCES calendar_events(id),
 requested_by uuid NOT NULL REFERENCES users(id), purpose text NOT NULL CHECK(purpose IN ('study','party')),
 approval_state text NOT NULL DEFAULT 'pending' CHECK(approval_state IN ('pending','approved','rejected')),
 approved_by uuid REFERENCES users(id),approved_at timestamptz
);
CREATE TABLE teacher_profiles (person_id uuid PRIMARY KEY REFERENCES people(id),fee_per_lesson numeric(12,2) NOT NULL DEFAULT 0 CHECK(fee_per_lesson>=0));
CREATE TABLE student_teacher_links (student_id uuid REFERENCES people(id),teacher_id uuid REFERENCES people(id),starts_on date NOT NULL,ends_on date,PRIMARY KEY(student_id,teacher_id,starts_on));
CREATE TABLE lesson_classes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,teacher_id uuid NOT NULL REFERENCES people(id));
CREATE TABLE class_students (class_id uuid REFERENCES lesson_classes(id),student_id uuid REFERENCES people(id),joined_on date NOT NULL,left_on date,PRIMARY KEY(class_id,student_id,joined_on));
CREATE TABLE lessons (
 event_id uuid PRIMARY KEY REFERENCES calendar_events(id),teacher_id uuid NOT NULL REFERENCES people(id),class_id uuid REFERENCES lesson_classes(id),
 original_lesson_id uuid REFERENCES lessons(event_id),status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','held','absent','cancelled','recovery_planned')),
 remunerable boolean NOT NULL DEFAULT false, locked_fee numeric(12,2)
);
CREATE TABLE lesson_students (event_id uuid REFERENCES lessons(event_id),student_id uuid REFERENCES people(id),attendance text DEFAULT 'unknown' CHECK(attendance IN ('unknown','present','absent')),PRIMARY KEY(event_id,student_id));
CREATE TABLE projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,description text,created_by uuid NOT NULL REFERENCES users(id),event_id uuid REFERENCES calendar_events(id),status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),closed_at timestamptz);
CREATE TABLE project_collaborators (project_id uuid REFERENCES projects(id),user_id uuid REFERENCES users(id),can_edit boolean NOT NULL DEFAULT true,PRIMARY KEY(project_id,user_id));
CREATE TABLE document_objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),storage_key text NOT NULL UNIQUE,original_name text NOT NULL,mime_type text,sha256 text,uploaded_by uuid REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE file_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL REFERENCES document_objects(id),target_type text NOT NULL,target_id uuid NOT NULL,visibility text NOT NULL DEFAULT 'restricted');
CREATE TABLE ledger_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),occurred_on date NOT NULL,kind text NOT NULL CHECK(kind IN ('income','expense')),
 category text NOT NULL,description text,notes text,counterparty text,amount numeric(14,2) NOT NULL CHECK(amount>=0),
 project_id uuid REFERENCES projects(id),event_id uuid REFERENCES calendar_events(id),membership_fee_id uuid REFERENCES membership_fees(id),
 payment_state text NOT NULL DEFAULT 'planned' CHECK(payment_state IN ('planned','settled')),
 created_by uuid REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE event_compensations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES calendar_events(id),person_id uuid NOT NULL REFERENCES people(id),
 compensation_type text NOT NULL CHECK(compensation_type IN ('member','external')),
 rate_band integer CHECK(rate_band IN (1,2,3)),amount numeric(12,2) NOT NULL CHECK(amount>=0),
 note text,UNIQUE(event_id,person_id,compensation_type)
);
CREATE TABLE teacher_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),teacher_id uuid NOT NULL REFERENCES people(id),
 amount numeric(14,2) NOT NULL CHECK(amount>=0),paid_at timestamptz NOT NULL DEFAULT now(),paid_by uuid NOT NULL REFERENCES users(id),receipt_document_id uuid REFERENCES document_objects(id)
);
CREATE TABLE teacher_payment_lessons (payment_id uuid NOT NULL REFERENCES teacher_payments(id),lesson_id uuid NOT NULL UNIQUE REFERENCES lessons(event_id),amount numeric(12,2) NOT NULL,PRIMARY KEY(payment_id,lesson_id));
CREATE TABLE member_annual_settlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),membership_id uuid NOT NULL REFERENCES association_memberships(id),year integer NOT NULL,
 gross_amount numeric(14,2) NOT NULL,withholdings numeric(14,2) NOT NULL DEFAULT 0,net_amount numeric(14,2) NOT NULL,
 frozen_at timestamptz,treasurer_confirmed_by uuid REFERENCES users(id),treasurer_confirmed_at timestamptz,
 member_confirmed_by uuid REFERENCES users(id),member_confirmed_at timestamptz,
 finalized_at timestamptz, UNIQUE(membership_id,year),
 CHECK(net_amount=gross_amount-withholdings)
);
CREATE TABLE settlement_event_lines (settlement_id uuid REFERENCES member_annual_settlements(id),compensation_id uuid UNIQUE REFERENCES event_compensations(id),amount numeric(12,2) NOT NULL,PRIMARY KEY(settlement_id,compensation_id));
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),title text NOT NULL,body text,scheduled_at timestamptz,delivered_at timestamptz,read_at timestamptz);
CREATE TABLE conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE conversation_members (conversation_id uuid REFERENCES conversations(id),user_id uuid REFERENCES users(id),PRIMARY KEY(conversation_id,user_id));
CREATE TABLE messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES conversations(id),sender_id uuid NOT NULL REFERENCES users(id),body text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_log (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid REFERENCES users(id),action text NOT NULL,target_type text,target_id uuid,before_value jsonb,after_value jsonb,at timestamptz NOT NULL DEFAULT now());
-- Beta: il server/API di autenticazione e le policy RLS sono volutamente non distribuiti.
-- Queste tabelle NON devono essere accessibili direttamente da un browser anonimo.
COMMIT;
