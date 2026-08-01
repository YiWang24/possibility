-- Rule + AI dual-layer card-game result.
-- The rule snapshot remains authoritative. AI only adds a cached narrative to
-- an already validated run and can never change cards, scores, or profile facts.

alter table public.card_game_runs
  add column ai_narrative_status text not null default 'pending',
  add column ai_narrative jsonb,
  add column ai_narrative_schema_version smallint,
  add column ai_narrative_prompt_version text,
  add column ai_narrative_model text,
  add column ai_narrative_generation_id uuid,
  add column ai_narrative_attempts smallint not null default 0,
  add column ai_narrative_started_at timestamptz,
  add column ai_narrative_generated_at timestamptz,
  add column ai_narrative_error_code text,
  add constraint card_game_runs_ai_narrative_status_check
    check (ai_narrative_status in ('pending', 'generating', 'ready', 'failed')),
  add constraint card_game_runs_ai_narrative_attempts_check
    check (ai_narrative_attempts >= 0),
  add constraint card_game_runs_ai_narrative_shape_check
    check (
      ai_narrative_status <> 'ready'
      or (
        coalesce(jsonb_typeof(ai_narrative) = 'object', false)
        and ai_narrative_schema_version is not null
        and ai_narrative_prompt_version is not null
        and ai_narrative_model is not null
        and ai_narrative_generated_at is not null
      )
    ),
  add constraint card_game_runs_ai_narrative_generation_check
    check (
      ai_narrative_status <> 'generating'
      or (
        ai_narrative_generation_id is not null
        and ai_narrative_started_at is not null
      )
    );

comment on column public.card_game_runs.ai_snapshot is
  'Versioned rule-derived evidence for downstream AI. Never model output.';
comment on column public.card_game_runs.ai_narrative is
  'Private, schema-validated AI narrative grounded only in this run evidence.';
comment on column public.card_game_runs.ai_narrative_generation_id is
  'Compare-and-set token preventing stale or duplicate workers from overwriting a result.';
