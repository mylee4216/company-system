-- 2) companies 테이블 생성
create table if not exists public.companies (
  id bigint generated always as identity primary key,
  name text not null,
  business_number text,
  address text
);

-- 1) daily_workers 테이블 확장
alter table if exists public.daily_workers
  add column if not exists phone text,
  add column if not exists resident_number text,
  add column if not exists address text,
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists job_type text,
  add column if not exists company_id bigint references public.companies(id);

-- 3) sites 테이블 생성
create table if not exists public.sites (
  id bigint generated always as identity primary key,
  name text not null,
  company_id bigint not null references public.companies(id) on delete cascade,
  start_date date,
  end_date date
);

-- 4) daily_worker_monthly_records 테이블 수정
alter table if exists public.daily_worker_monthly_records
  add column if not exists site_id bigint references public.sites(id);

-- 월별 공수 고유키를 현장 기준으로 확장
create unique index if not exists daily_worker_monthly_records_worker_site_month_key
  on public.daily_worker_monthly_records (daily_worker_id, site_id, target_month);
