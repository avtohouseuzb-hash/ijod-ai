-- News pipeline queue indexes and scheduled collection/processing.
create index if not exists news_articles_pending_queue_idx
  on public.news_articles (status, processing_next_attempt_at, published_at)
  where status = 'pending_translation';

create index if not exists news_deliveries_retry_queue_idx
  on public.news_deliveries (status, next_attempt_at, created_at)
  where status in ('queued', 'retry');

create index if not exists news_pipeline_runs_started_at_idx
  on public.news_pipeline_runs (started_at desc);

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'ijod-ai-news-pipeline') then
    perform cron.schedule(
      'ijod-ai-news-pipeline',
      '*/10 * * * *',
      $job$
        select net.http_get(
          url := 'https://ijod-ai.vercel.app/api/news/run?phase=cycle',
          headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ijod_news_cron_token' limit 1)
          ),
          timeout_milliseconds := 55000
        );
      $job$
    );
  end if;
end $$;
