-- Rename legacy playground_shortcuts table to moodboard_cards.
-- Run once in production before deploying the new API endpoints.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'playground_shortcuts'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'moodboard_cards'
    ) THEN
      ALTER TABLE public.playground_shortcuts RENAME TO moodboard_cards;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS moodboard_cards_sort_order_idx ON public.moodboard_cards(sort_order ASC);
CREATE INDEX IF NOT EXISTS moodboard_cards_created_at_idx ON public.moodboard_cards(created_at ASC);

ALTER TABLE IF EXISTS public.moodboard_cards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'moodboard_cards'
      AND policyname = 'Allow anonymous access'
  ) THEN
    CREATE POLICY "Allow anonymous access"
      ON public.moodboard_cards
      FOR ALL
      USING (true);
  END IF;
END $$;
