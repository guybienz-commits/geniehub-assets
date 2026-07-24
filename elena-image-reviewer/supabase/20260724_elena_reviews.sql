-- Elena Bildprüfung: Reviews + Few-Shot-Lernbeispiele (Lernschleife)

create table if not exists public.elena_reviews (
  id uuid primary key default gen_random_uuid(),
  inserat_id uuid references public.inserate(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  bild_url text not null,
  fahrzeug jsonb not null,
  ergebnis jsonb not null,          -- validated ElenaReview JSON from the model
  modell text,
  status text not null default 'offen'
    check (status in ('offen', 'bestaetigt', 'korrigiert')),
  korrektur jsonb,                  -- moderator ground truth, overrules ergebnis
  bildbeschreibung text,            -- textual stand-in for the image in few-shot prompts
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists elena_reviews_status_idx
  on public.elena_reviews (status, created_at desc);

create table if not exists public.elena_fewshot_beispiele (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.elena_reviews(id) on delete cascade,
  fahrzeug jsonb not null,
  bildbeschreibung text not null,
  ergebnis jsonb not null,
  quelle text not null default 'seed'
    check (quelle in ('seed', 'bestaetigt', 'korrigiert')),
  sortierung integer not null default 0,
  aktiv boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists elena_fewshot_aktiv_idx
  on public.elena_fewshot_beispiele (aktiv, sortierung);

-- RLS: Nutzer sehen nur eigene Reviews; Schreibzugriff und Few-Shot-Pflege
-- laufen ausschliesslich über die Service-Role (keine öffentlichen Policies).
alter table public.elena_reviews enable row level security;
alter table public.elena_fewshot_beispiele enable row level security;

create policy "Elena-Reviews: eigene lesen" on public.elena_reviews
  for select using (auth.uid() = user_id);
