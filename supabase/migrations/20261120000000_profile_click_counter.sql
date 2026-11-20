CREATE TABLE IF NOT EXISTS public.github_profile_clicks (
  id smallint PRIMARY KEY CHECK (id = 1),
  click_count bigint NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

INSERT INTO public.github_profile_clicks (id, click_count)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.github_profile_clicks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.github_profile_clicks FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_github_profile_click_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT click_count
  FROM public.github_profile_clicks
  WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.record_github_profile_click()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_count bigint;
BEGIN
  INSERT INTO public.github_profile_clicks AS clicks (id, click_count)
  VALUES (1, 1)
  ON CONFLICT (id) DO UPDATE
  SET click_count = clicks.click_count + 1,
      updated_at = pg_catalog.now()
  RETURNING click_count INTO new_count;

  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_github_profile_click_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_github_profile_click() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_github_profile_click_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_github_profile_click() TO anon, authenticated;
