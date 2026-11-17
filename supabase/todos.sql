-- To-Do-Liste (einfache Aufgaben, zählen nicht zur Habit-Quote)
-- Im Dashboard unter "SQL Editor" ausführen. Muss vor dem Hochladen der neuen App-Version laufen.
--
-- list    = 'today' (Heute) oder 'later' (Später)
-- done    = erledigt (steht dann im eingeklappten Bereich "Erledigt")
-- deleted = gelöscht (bleibt als Markierung erhalten, damit das Löschen auf allen Geräten ankommt und rückgängig gemacht werden kann)

create table public.todos (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  text       text not null check (char_length(text) between 1 and 200),
  list       text not null default 'today' check (list in ('today', 'later')),
  done       boolean not null default false,
  deleted    boolean not null default false,
  created_at timestamptz not null default now(),   -- bestimmt die Reihenfolge
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Rechte (GRANT) und Zeilenregeln (RLS) wie bei habits und logs: nur eingeloggte Nutzer, nur eigene Zeilen.
grant select, insert, update, delete on public.todos to authenticated;
alter table public.todos enable row level security;

create policy "eigene todos" on public.todos
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
