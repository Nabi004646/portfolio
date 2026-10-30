-- User-supplied public profiles; preserve other settings and additional profiles.
update public.content_items c set data =
  '{"introEnabled":true,"introTitle":"NABI","introCaption":"Curiosity. Craft. A little fire.","introReplayLabel":"Replay intro"}'::jsonb
  || c.data
  || jsonb_build_object(
    'facebook','https://www.facebook.com/nabie.webdev',
    'github','https://github.com/Nabi004646',
    'socialLinks',
      coalesce((select jsonb_agg(link) from jsonb_array_elements(coalesce(c.data->'socialLinks','[]'::jsonb)) link
        where lower(coalesce(link->>'label','')) not in ('facebook','github')
          and coalesce(link->>'url','') not in ('https://www.facebook.com/nabie.webdev','https://github.com/Nabi004646')),'[]'::jsonb)
      || '[{"label":"Facebook","icon":"facebook","url":"https://www.facebook.com/nabie.webdev"},{"label":"GitHub","icon":"github","url":"https://github.com/Nabi004646"}]'::jsonb,
    'personalLinks',
      '[{"label":"Facebook","handle":"@nabie.webdev","icon":"facebook","url":"https://www.facebook.com/nabie.webdev"},{"label":"GitHub","handle":"@Nabi004646","icon":"github","url":"https://github.com/Nabi004646"}]'::jsonb
      || coalesce((select jsonb_agg(link) from jsonb_array_elements(coalesce(c.data->'personalLinks','[]'::jsonb)) link
        where lower(coalesce(link->>'label','')) not in ('facebook','github')
          and coalesce(link->>'url','') not in ('https://www.facebook.com/nabie.webdev','https://github.com/Nabi004646')),'[]'::jsonb)
  )
where c.id='settings';
