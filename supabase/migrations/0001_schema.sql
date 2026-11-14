-- שביל המצווה — מבנה הנתונים והרשאות
-- מריצים פעם אחת ב-Supabase: SQL Editor ← New query ← הדבקה ← Run

create extension if not exists pgcrypto;

-- ───────────── משתמשים ─────────────

-- רשימת המוזמנים. רק מי שהמייל שלו כאן יכול להיכנס לאתר.
create table public.invitations (
  email       text primary key check (email = lower(email)),
  role        text not null default 'member' check (role in ('admin', 'member')),
  note        text,
  invited_at  timestamptz not null default now(),
  invited_by  uuid references auth.users(id) on delete set null
);

-- פרופיל משפחה: גלוי לכל המוזמנים (שם משפחה ומספר משתתפים, בלי פרטי קשר).
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  family_name    text not null default '',
  contact_name   text not null default '',
  adults         int  not null default 2 check (adults between 0 and 20),
  children_ages  int[] not null default '{}',
  role           text not null default 'member' check (role in ('admin', 'member')),
  created_at     timestamptz not null default now()
);

-- פרטי קשר: רק המשפחה עצמה והמנהלת רואות.
create table public.profile_contacts (
  id     uuid primary key references public.profiles(id) on delete cascade,
  email  text not null,
  phone  text not null default ''
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

-- כשמישהו נכנס בפעם הראשונה: אם הוזמן — נוצר לו פרופיל. אם לא — הכניסה נחסמת.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv invitations;
begin
  select * into inv from invitations where email = lower(new.email);
  if not found then
    raise exception 'not_invited';
  end if;
  insert into profiles (id, role) values (new.id, inv.role);
  insert into profile_contacts (id, email) values (new.id, lower(new.email));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── תוכן ─────────────

create table public.segments (
  number       int primary key check (number between 1 and 56),
  name         text not null,
  start_name   text not null default '',
  end_name     text not null default '',
  region       text not null default '',
  official_km  numeric(5,1),
  seasons      text not null default '',
  notes        text not null default '',
  source_url   text not null default ''
);

create table public.trips (
  id               uuid primary key default gen_random_uuid(),
  legacy_id        text unique,
  title            text not null,
  summary          text not null default '',
  region           text not null default '',
  start_date       date,
  end_date         date,
  date_status      text not null default 'confirmed' check (date_status in ('confirmed', 'proposed')),
  status           text not null default 'planned'
                   check (status in ('planned', 'to_reschedule', 'completed', 'cancelled')),
  kind             text not null default 'regular'
                   check (kind in ('regular', 'reserve', 'mitzvah', 'blocked')),
  drive_time       text not null default '',
  -- הערכה לתכנון ברמת הטיול, כשעוד אין מרחק לכל יום
  total_km_hint    numeric(5,1),
  difficulty       text not null default '',
  accommodation    text not null default '',
  cover_url        text not null default '',
  notes            text not null default '',
  family_activity  text not null default '',
  dog_allowed      boolean,
  dog_notes        text not null default '',
  -- עדכונים עדכניים: מוצגים רק כשיש בהם תוכן
  weather_note     text not null default '',
  area_closures    text not null default '',
  flood_alert      text not null default '',
  route_changes    text not null default '',
  recap            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.trip_days (
  id                 uuid primary key default gen_random_uuid(),
  legacy_id          text unique,
  trip_id            uuid not null references public.trips(id) on delete cascade,
  date               date,
  day_number         int not null default 1,
  segment_number     int references public.segments(number),
  kind               text not null default 'split' check (kind in ('split', 'family', 'mitzvah')),
  title              text not null default '',
  start_name         text not null default '',
  start_url          text not null default '',
  end_name           text not null default '',
  end_url            text not null default '',
  -- שני מדדים שלא מערבבים: סה"כ הליכה מול ק"מ מאומתים על שביל ישראל
  distance_km        numeric(5,1),
  trail_km           numeric(5,1),
  partial_route      boolean not null default false,
  duration_text      text not null default '',
  difficulty         text not null default '',
  ascent_m           int,
  descent_m          int,
  route_type         text not null default '',
  route_description  text not null default '',
  route_map_url      text not null default '',
  main_participants  text not null default '',
  sun_exposure       text not null default '',
  water_liters       numeric(3,1),
  water_guidance     text not null default '',
  water_crossing     text not null default '',
  max_water_depth    text not null default '',
  escape_points      text not null default '',
  safety_notes       text not null default '',
  gear               text not null default '',
  shuttle_required   boolean,
  shuttle_details    text not null default '',
  shuttle_drivers    text not null default '',
  parking_notes      text not null default '',
  drive_minutes      int,
  young_enabled      boolean not null default false,
  young_title        text not null default '',
  young_type         text not null default '' check (young_type in ('', 'together', 'join_end', 'parallel')),
  young_start        text not null default '',
  young_end          text not null default '',
  young_km           numeric(4,1) check (young_km is null or young_km <= 7),
  young_route_type   text not null default '',
  young_duration     text not null default '',
  young_difficulty   text not null default '',
  young_meetup       text not null default '',
  young_notes        text not null default '',
  verification       text not null default '',
  verification_source text not null default '',
  verification_url   text not null default '',
  -- מילוי אחרי הטיול
  completion         text not null default 'none' check (completion in ('none', 'partial', 'completed')),
  completed_km       numeric(5,1),
  completion_note    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.trip_days (trip_id);
create index on public.trip_days (segment_number);

create table public.enrichment (
  id                  uuid primary key default gen_random_uuid(),
  trip_day_id         uuid references public.trip_days(id) on delete set null,
  segment_number      int references public.segments(number),
  location            text not null default '',
  geography           text not null default '',
  nature              text not null default '',
  history             text not null default '',
  people_and_culture  text not null default '',
  things_to_notice    text not null default '',
  surprising_facts    text not null default '',
  trivia_question     text not null default '',
  trivia_answer       text not null default '',
  sources             text not null default '',
  published           boolean not null default false
);

create table public.settings (
  id               int primary key default 1 check (id = 1),
  intro_text       text not null default '',
  whatsapp_url     text not null default '',
  organizer_email  text not null default '',
  -- תקופות שאי אפשר לשבץ בהן טיול, למשל הטיול לחו"ל
  blocked_periods  jsonb not null default '[]'
);
insert into public.settings (id) values (1);

-- ───────────── פעילות המשפחות ─────────────

create table public.registrations (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  day_ids         uuid[] not null default '{}',
  adults          int not null default 0 check (adults >= 0),
  children        int not null default 0 check (children >= 0),
  full_count      int not null default 0 check (full_count >= 0),
  arriving_by_car boolean not null default false,
  car_seats       int not null default 0 check (car_seats >= 0),
  consent         boolean not null default false check (consent),
  status          text not null default 'active' check (status in ('active', 'cancelled')),
  admin_note      text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table public.ambassadors (
  id              uuid primary key default gen_random_uuid(),
  segment_number  int not null references public.segments(number),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  plan            text not null default '',
  status          text not null default 'pending' check (status in ('pending', 'approved')),
  created_at      timestamptz not null default now(),
  unique (segment_number, user_id)
);

-- ───────────── חוקים ─────────────

-- ההרשמה נסגרת 72 שעות לפני תחילת יום היציאה (שעון ישראל),
-- וסגורה גם לטיול שאינו מתוכנן, שתאריכו רק מוצע, או שהוא רזרבה/חסום.
create or replace function public.registration_closes_at(t trips) returns timestamptz
language sql stable as $$
  select (t.start_date::timestamp at time zone 'Asia/Jerusalem') - interval '72 hours';
$$;

create or replace function public.registration_open(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trips t
    where t.id = p_trip
      and t.status = 'planned'
      and t.date_status = 'confirmed'
      and t.kind in ('regular', 'mitzvah')
      and t.start_date is not null
      and now() < registration_closes_at(t)
  );
$$;

-- updated_at אוטומטי
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trips_touch before update on public.trips for each row execute function public.touch();
create trigger days_touch before update on public.trip_days for each row execute function public.touch();
create trigger reg_touch before update on public.registrations for each row execute function public.touch();

-- ───────────── הרשאות (Row Level Security) ─────────────

alter table public.invitations      enable row level security;
alter table public.profiles         enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.segments         enable row level security;
alter table public.trips            enable row level security;
alter table public.trip_days        enable row level security;
alter table public.enrichment       enable row level security;
alter table public.settings         enable row level security;
alter table public.registrations    enable row level security;
alter table public.ambassadors      enable row level security;

-- מוזמנים: רק מנהלת
create policy inv_admin on public.invitations for all using (is_admin()) with check (is_admin());

-- פרופילים: כל מוזמן רואה; כל משפחה עורכת את שלה (בלי לשנות תפקיד); מנהלת הכול
create policy prof_read on public.profiles for select using (is_member());
create policy prof_update_own on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from profiles p where p.id = auth.uid()));
create policy prof_admin on public.profiles for all using (is_admin()) with check (is_admin());

create policy contact_own on public.profile_contacts for select using (id = auth.uid() or is_admin());
create policy contact_update_own on public.profile_contacts for update using (id = auth.uid()) with check (id = auth.uid());
create policy contact_admin on public.profile_contacts for all using (is_admin()) with check (is_admin());

-- תוכן: מוזמנים קוראים, מנהלת כותבת
create policy seg_read  on public.segments   for select using (is_member());
create policy seg_admin on public.segments   for all using (is_admin()) with check (is_admin());
create policy trip_read  on public.trips     for select using (is_member());
create policy trip_admin on public.trips     for all using (is_admin()) with check (is_admin());
create policy day_read  on public.trip_days  for select using (is_member());
create policy day_admin on public.trip_days  for all using (is_admin()) with check (is_admin());
create policy enr_read  on public.enrichment for select using (is_member() and (published or is_admin()));
create policy enr_admin on public.enrichment for all using (is_admin()) with check (is_admin());
create policy set_read  on public.settings   for select using (is_member());
create policy set_admin on public.settings   for all using (is_admin()) with check (is_admin());

-- הרשמות: כולם רואים מי מגיע; כל משפחה יוצרת ומעדכנת את שלה רק בחלון ההרשמה
create policy reg_read on public.registrations for select using (is_member());
create policy reg_insert_own on public.registrations for insert
  with check (user_id = auth.uid() and registration_open(trip_id) and admin_note = '');
create policy reg_update_own on public.registrations for update
  using (user_id = auth.uid() and registration_open(trip_id))
  with check (user_id = auth.uid() and registration_open(trip_id));
create policy reg_admin on public.registrations for all using (is_admin()) with check (is_admin());

-- שגרירים: כולם רואים; כל אחד מתנדב בשם עצמו (ממתין לאישור) ויכול לבטל
create policy amb_read on public.ambassadors for select using (is_member());
create policy amb_insert_own on public.ambassadors for insert
  with check (user_id = auth.uid() and status = 'pending');
create policy amb_delete_own on public.ambassadors for delete using (user_id = auth.uid());
create policy amb_admin on public.ambassadors for all using (is_admin()) with check (is_admin());

-- משפחה לא יכולה לשנות שדה admin_note בהרשמה שלה
create or replace function public.protect_admin_note() returns trigger language plpgsql as $$
begin
  if not is_admin() and new.admin_note is distinct from old.admin_note then
    new.admin_note := old.admin_note;
  end if;
  return new;
end $$;
create trigger reg_protect before update on public.registrations
  for each row execute function public.protect_admin_note();
