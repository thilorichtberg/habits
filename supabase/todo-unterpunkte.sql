-- To-Do: Unterpunkte und Presets
-- Im Dashboard unter "SQL Editor" ausführen. Muss vor dem Hochladen der neuen App-Version laufen.
--
-- todos.subs        = Unterpunkte als Liste: [{"id":"s1","text":"Zahnbürste","done":false}, ...]
-- todo_presets      = gespeicherte Vorlagen (Titel + Texte der Unterpunkte), zum Wiederverwenden beim Erstellen

alter table public.todos
  add column subs jsonb not null default '[]'::jsonb
  check (jsonb_typeof(subs) = 'array' and jsonb_array_length(subs) <= 100);

create table public.todo_presets (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  name       text not null check (char_length(name) between 1 and 200),
  subs       jsonb not null default '[]'::jsonb check (jsonb_typeof(subs) = 'array' and jsonb_array_length(subs) <= 100),  -- nur die Texte
  deleted    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

grant select, insert, update, delete on public.todo_presets to authenticated;
alter table public.todo_presets enable row level security;

create policy "eigene presets" on public.todo_presets
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
