-- Private tables. Access is through service-role-only RPCs, never browser queries.
create table public.analyses (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (skill in ('competitor_spy', 'trend_detector')),
  query text not null,
  parameters jsonb not null,
  status text not null check (status = 'completed'),
  result_json jsonb not null,
  created_at timestamptz not null default now()
);
create index analyses_owner_created_idx on public.analyses(owner_id, created_at desc);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  platform text not null,
  source_url text not null,
  metadata_json jsonb not null,
  collected_at timestamptz not null default now(),
  unique (platform, provider_id)
);

create table public.analysis_videos (
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  video_id uuid not null references public.videos(id),
  -- Result snapshots keep their original evidence IDs when sources are reused.
  evidence_id uuid not null,
  primary key (analysis_id, video_id),
  unique (analysis_id, evidence_id)
);

create table public.analysis_quotas (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null check (requests > 0)
);

alter table public.analyses enable row level security;
alter table public.videos enable row level security;
alter table public.analysis_videos enable row level security;
alter table public.analysis_quotas enable row level security;
revoke all on public.analyses, public.videos, public.analysis_videos, public.analysis_quotas from anon, authenticated;
grant all on public.analyses, public.videos, public.analysis_videos, public.analysis_quotas to service_role;

create function public.consume_feedintel_quota(p_owner uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare current_count integer;
begin
  insert into public.analysis_quotas as q (owner_id, window_start, requests)
  values (p_owner, date_trunc('minute', now()), 1)
  on conflict (owner_id) do update set
    window_start = excluded.window_start,
    requests = case when q.window_start = excluded.window_start then q.requests + 1 else 1 end
  returning requests into current_count;
  return current_count <= 5;
end;
$$;

create function public.save_feedintel_analysis(p_owner uuid, p_parameters jsonb, p_result jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  analysis_uuid uuid := (p_result->>'analysis_id')::uuid;
  video jsonb;
  stored_video_id uuid;
begin
  insert into public.analyses (id, owner_id, skill, query, parameters, status, result_json, created_at)
  values (analysis_uuid, p_owner, p_parameters->>'skill', p_parameters->>'query', p_parameters,
    'completed', p_result, (p_result->>'generated_at')::timestamptz);
  for video in select value from jsonb_array_elements(p_result->'videos') loop
    insert into public.videos (provider_id, platform, source_url, metadata_json)
    values (video->>'provider_id', video->>'platform', video->>'url', video)
    on conflict (platform, provider_id) do update set
      source_url = excluded.source_url, metadata_json = excluded.metadata_json, collected_at = now()
    returning id into stored_video_id;
    insert into public.analysis_videos (analysis_id, video_id, evidence_id)
    values (analysis_uuid, stored_video_id, (video->>'id')::uuid);
  end loop;
  return analysis_uuid;
end;
$$;

create function public.get_feedintel_analysis(p_owner uuid, p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select result_json from public.analyses where id = p_id and owner_id = p_owner;
$$;

create function public.list_feedintel_analyses(p_owner uuid, p_limit integer, p_offset integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(items) order by items.created_at desc, items.id desc), '[]'::jsonb)
  from (
    select id, skill, query, parameters, status, created_at from public.analyses
    where owner_id = p_owner order by created_at desc, id desc
    limit least(greatest(p_limit, 1), 100) offset least(greatest(p_offset, 0), 10000)
  ) items;
$$;

revoke all on function public.consume_feedintel_quota(uuid) from public, anon, authenticated;
revoke all on function public.save_feedintel_analysis(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_feedintel_analysis(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_feedintel_analyses(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_feedintel_quota(uuid) to service_role;
grant execute on function public.save_feedintel_analysis(uuid, jsonb, jsonb) to service_role;
grant execute on function public.get_feedintel_analysis(uuid, uuid) to service_role;
grant execute on function public.list_feedintel_analyses(uuid, integer, integer) to service_role;
