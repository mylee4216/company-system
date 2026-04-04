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

-- 5) employees 상태/퇴사일 확장
alter table if exists public.employees
  add column if not exists resignation_date date;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'employees_status_check'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees drop constraint employees_status_check;
  end if;
end $$;

alter table if exists public.employees
  add constraint employees_status_check
  check (status in ('재직', '퇴사', '휴직', '전출', '파견'));

-- 퇴사가 아닌 상태는 퇴사일이 없어야 함
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'employees_resignation_date_check'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees drop constraint employees_resignation_date_check;
  end if;
end $$;

alter table if exists public.employees
  add constraint employees_resignation_date_check
  check (
    (status = '퇴사' and resignation_date is not null)
    or (status <> '퇴사' and resignation_date is null)
  );

-- 6) employee_assignments 테이블 생성 (법인 이동/파견 이력)
create table if not exists public.employee_assignments (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  company_id bigint not null references public.companies(id),
  site_id bigint references public.sites(id),
  assignment_type text not null check (assignment_type in ('정규소속', '법인전출', '임시파견')),
  start_date date not null,
  end_date date,
  memo text,
  is_current boolean not null default true
);

create index if not exists employee_assignments_employee_id_idx
  on public.employee_assignments (employee_id);

create unique index if not exists employee_assignments_employee_current_key
  on public.employee_assignments (employee_id)
  where is_current = true;
