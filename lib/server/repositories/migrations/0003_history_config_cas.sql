-- Compare-and-swap uses a POST body so configs containing data URLs do not exceed URL limits.
CREATE OR REPLACE FUNCTION update_owned_history_config(
  p_id TEXT,
  p_owner_id TEXT,
  p_expected_config JSONB,
  p_config JSONB
)
RETURNS TABLE(id VARCHAR)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.generations AS g
  SET config = p_config
  WHERE g.id = p_id AND g.user_id = p_owner_id AND g.config = p_expected_config
  RETURNING g.id;
$$;
NOTIFY pgrst, 'reload schema';
