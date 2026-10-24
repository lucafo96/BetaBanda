-- BetaBanda: modulo Gestione divise (specifica iniziale, NON deploy produzione).
-- Applicare DOPO 001_schema.sql, in ambiente di sviluppo senza dati reali.
BEGIN;
INSERT INTO role_definitions(role_key,display_name) VALUES ('uniform_manager','Gestore divise') ON CONFLICT(role_key) DO NOTHING;
CREATE TABLE uniform_articles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE uniform_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), article_id uuid NOT NULL REFERENCES uniform_articles(id), size_label text NOT NULL,
 acquisition_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK(acquisition_cost>=0), sale_price numeric(12,2) NOT NULL DEFAULT 0 CHECK(sale_price>=0),
 UNIQUE(article_id,size_label)
);
CREATE TABLE uniform_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES people(id),variant_id uuid NOT NULL REFERENCES uniform_variants(id),
 request_type text NOT NULL CHECK(request_type IN ('new','replacement')),quantity integer NOT NULL CHECK(quantity>0),
 desired_ownership text NOT NULL DEFAULT 'band' CHECK(desired_ownership IN ('band','personal')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','fulfilled','rejected','cancelled')),
 note text,requested_at timestamptz NOT NULL DEFAULT now(),fulfilled_at timestamptz,handled_by uuid REFERENCES users(id)
);
CREATE TABLE uniform_holdings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),person_id uuid NOT NULL REFERENCES people(id),variant_id uuid NOT NULL REFERENCES uniform_variants(id),
 quantity integer NOT NULL CHECK(quantity>0),ownership text NOT NULL CHECK(ownership IN ('band','personal')),
 handed_over_at timestamptz,returned_at timestamptz,origin text NOT NULL DEFAULT 'delivery' CHECK(origin IN ('delivery','initial_declaration')),
 validated_by uuid REFERENCES users(id),request_id uuid REFERENCES uniform_requests(id), notes text
);
CREATE TABLE uniform_stock_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),variant_id uuid NOT NULL REFERENCES uniform_variants(id),
 movement_type text NOT NULL CHECK(movement_type IN ('opening','purchase','delivery','sale','return_reusable','return_scrap','adjustment')),
 quantity_delta integer NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
 person_id uuid REFERENCES people(id),holding_id uuid REFERENCES uniform_holdings(id),
 related_ledger_entry uuid REFERENCES ledger_entries(id),performed_by uuid REFERENCES users(id),notes text
);
-- Giacenza = SUM(quantity_delta), NON campo aggiornabile separato.
-- Vendite: movimento stock distinto da incasso nel ledger.
-- Inizializzazione dotazione personale: origin=initial_declaration, NON generare automaticamente nuovo scarico stock.
-- Tutte le mutazioni richiedono API sicure, controllo ruoli e transazioni atomiche (DA IMPLEMENTARE).
COMMIT;
