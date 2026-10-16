-- Rename the starting title 'Unawakened' to Aeternum's own 'Unkindled'.
ALTER TABLE public.players ALTER COLUMN title SET DEFAULT 'Unkindled';
UPDATE public.players SET title = 'Unkindled' WHERE title = 'Unawakened';
