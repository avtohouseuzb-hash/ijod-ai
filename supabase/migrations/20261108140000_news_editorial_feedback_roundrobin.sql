-- IJOD AI News: editorial scoring, category round-robin and Telegram feedback.
alter table public.news_articles
  add column if not exists editorial_score smallint,
  add column if not exists editorial_reason text,
  add column if not exists editorial_quality jsonb not null default '{}'::jsonb;

alter table public.news_articles
  drop constraint if exists news_articles_editorial_score_check;
alter table public.news_articles
  add constraint news_articles_editorial_score_check
  check (editorial_score is null or editorial_score between 1 and 10);

alter table public.news_pipeline_state
  add column if not exists last_processed_category text;

create table if not exists public.news_article_feedback (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles(id) on delete cascade,
  telegram_user_id bigint not null,
  chat_id text not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, telegram_user_id)
);

create index if not exists news_article_feedback_article_vote_idx
  on public.news_article_feedback (article_id, vote);
create index if not exists news_article_feedback_user_created_idx
  on public.news_article_feedback (telegram_user_id, created_at desc);

alter table public.news_article_feedback enable row level security;
revoke all on public.news_article_feedback from anon, authenticated;
