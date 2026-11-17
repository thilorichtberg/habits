-- Emoji als optionales Symbol für Habits, To-Dos und Presets
-- Im Dashboard unter "SQL Editor" ausführen. Muss vor dem Deployen der neuen Funktion und dem Hochladen der App laufen.

alter table public.habits       add column emoji text check (emoji is null or char_length(emoji) <= 16);
alter table public.todos        add column emoji text check (emoji is null or char_length(emoji) <= 16);
alter table public.todo_presets add column emoji text check (emoji is null or char_length(emoji) <= 16);
