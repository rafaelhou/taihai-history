-- ═══════════════════════════════════════════════════════════
-- 訪問計數器 — 這個站需要的設定
--
-- counters 表、RLS 與 increment_counter / get_counter 兩個函式，
-- 在建 minecraft-parent-guide 時就已經在同一個 Supabase 專案裡建好了
-- （Project ID ciptftupkllmwwnrqmkt），不需要重建。
--
-- 這個站唯一要做的，是替它新增一列計數器。
-- increment_counter 對不存在的 id 會直接 raise exception（前端收到 400
-- 就把整塊計數器藏起來），所以沒跑這行的話，頁尾不會顯示瀏覽次數。
--
-- 做法：Supabase Dashboard → SQL Editor → 貼上下面這行 → Run
-- ═══════════════════════════════════════════════════════════

insert into public.counters (id, count)
values ('taihai', 0)
on conflict (id) do nothing;


-- ── 參考：完整設定（如果哪天要換到全新的 Supabase 專案才需要跑）─────
--
-- create table if not exists public.counters (
--   id         text        primary key,
--   count      bigint      not null default 0,
--   updated_at timestamptz not null default now()
-- );
--
-- alter table public.counters enable row level security;   -- 不建任何 policy
--
-- create or replace function public.increment_counter(counter_id text)
-- returns bigint language plpgsql security definer set search_path = public as $$
-- declare new_count bigint;
-- begin
--   update public.counters set count = count + 1, updated_at = now()
--    where id = counter_id returning count into new_count;
--   if new_count is null then raise exception 'unknown counter: %', counter_id; end if;
--   return new_count;
-- end; $$;
--
-- create or replace function public.get_counter(counter_id text)
-- returns bigint language sql security definer set search_path = public as $$
--   select count from public.counters where id = counter_id;
-- $$;
--
-- revoke all on function public.increment_counter(text) from public, anon;
-- revoke all on function public.get_counter(text)       from public, anon;
-- grant execute on function public.increment_counter(text) to anon;
-- grant execute on function public.get_counter(text)       to anon;
