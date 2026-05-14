drop extension if exists "pg_net";

create sequence "public"."users_id_seq";


  create table "public"."bookings" (
    "booking_id" character varying(20) not null,
    "passenger_id" character varying(20) not null,
    "train_id" character varying(20) not null,
    "date" date not null,
    "seats" integer not null,
    "class" character varying(20) not null,
    "fare" numeric(10,2) not null,
    "status" character varying(20) not null default 'Active'::character varying,
    "created_at" timestamp without time zone not null default now(),
    "schedule_id" text
      );


alter table "public"."bookings" enable row level security;


  create table "public"."passengers" (
    "id" character varying(20) not null,
    "name" character varying(100) not null,
    "age" integer not null,
    "gender" character varying(10) not null,
    "contact" character varying(10) not null,
    "email" character varying(100) not null,
    "created_at" timestamp without time zone not null default now()
      );


alter table "public"."passengers" enable row level security;


  create table "public"."revenue" (
    "date" date not null,
    "total_bookings" integer not null default 0,
    "total_revenue" numeric(10,2) not null default 0,
    "cancellations" integer not null default 0
      );


alter table "public"."revenue" enable row level security;


  create table "public"."routes" (
    "route_id" character varying(20) not null,
    "name" character varying(100) not null,
    "stops" text[] not null,
    "distance_km" numeric(8,2) not null,
    "duration_min" integer not null
      );


alter table "public"."routes" enable row level security;


  create table "public"."schedules" (
    "schedule_id" character varying(20) not null,
    "train_id" character varying(20) not null,
    "date" date not null,
    "platform" integer not null,
    "delay_minutes" integer not null default 0,
    "seats_available" integer
      );


alter table "public"."schedules" enable row level security;


  create table "public"."trains" (
    "id" character varying(20) not null,
    "name" character varying(100) not null,
    "from_city" character varying(100) not null,
    "to_city" character varying(100) not null,
    "departure" time without time zone not null,
    "arrival" time without time zone not null,
    "fare_economy" numeric(8,2) not null,
    "fare_business" numeric(8,2) not null,
    "seats_total" integer not null,
    "seats_available" integer not null,
    "status" character varying(20) not null
      );


alter table "public"."trains" enable row level security;


  create table "public"."users" (
    "id" integer not null default nextval('public.users_id_seq'::regclass),
    "username" character varying(50) not null,
    "password" character varying(100) not null,
    "role" character varying(20) not null,
    "display_name" character varying(100) not null,
    "passenger_id" character varying(20),
    "created_at" timestamp without time zone not null default now()
      );


alter table "public"."users" enable row level security;

alter sequence "public"."users_id_seq" owned by "public"."users"."id";

CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (booking_id);

CREATE INDEX bookings_schedule_id_idx ON public.bookings USING btree (schedule_id);

CREATE INDEX idx_bookings_passenger ON public.bookings USING btree (passenger_id);

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);

CREATE INDEX idx_bookings_train_date ON public.bookings USING btree (train_id, date);

CREATE INDEX idx_trains_route ON public.trains USING btree (from_city, to_city);

CREATE UNIQUE INDEX passengers_email_key ON public.passengers USING btree (email);

CREATE UNIQUE INDEX passengers_pkey ON public.passengers USING btree (id);

CREATE UNIQUE INDEX revenue_pkey ON public.revenue USING btree (date);

CREATE UNIQUE INDEX routes_pkey ON public.routes USING btree (route_id);

CREATE UNIQUE INDEX schedules_pkey ON public.schedules USING btree (schedule_id);

CREATE UNIQUE INDEX schedules_train_id_date_key ON public.schedules USING btree (train_id, date);

CREATE UNIQUE INDEX trains_pkey ON public.trains USING btree (id);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);

alter table "public"."bookings" add constraint "bookings_pkey" PRIMARY KEY using index "bookings_pkey";

alter table "public"."passengers" add constraint "passengers_pkey" PRIMARY KEY using index "passengers_pkey";

alter table "public"."revenue" add constraint "revenue_pkey" PRIMARY KEY using index "revenue_pkey";

alter table "public"."routes" add constraint "routes_pkey" PRIMARY KEY using index "routes_pkey";

alter table "public"."schedules" add constraint "schedules_pkey" PRIMARY KEY using index "schedules_pkey";

alter table "public"."trains" add constraint "trains_pkey" PRIMARY KEY using index "trains_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."bookings" add constraint "bookings_class_check" CHECK (((class)::text = ANY ((ARRAY['Economy'::character varying, 'Business'::character varying])::text[]))) not valid;

alter table "public"."bookings" validate constraint "bookings_class_check";

alter table "public"."bookings" add constraint "bookings_fare_check" CHECK ((fare >= (0)::numeric)) not valid;

alter table "public"."bookings" validate constraint "bookings_fare_check";

alter table "public"."bookings" add constraint "bookings_passenger_id_fkey" FOREIGN KEY (passenger_id) REFERENCES public.passengers(id) ON DELETE RESTRICT not valid;

alter table "public"."bookings" validate constraint "bookings_passenger_id_fkey";

alter table "public"."bookings" add constraint "bookings_schedule_id_fkey" FOREIGN KEY (schedule_id) REFERENCES public.schedules(schedule_id) ON DELETE SET NULL not valid;

alter table "public"."bookings" validate constraint "bookings_schedule_id_fkey";

alter table "public"."bookings" add constraint "bookings_seats_check" CHECK (((seats >= 1) AND (seats <= 6))) not valid;

alter table "public"."bookings" validate constraint "bookings_seats_check";

alter table "public"."bookings" add constraint "bookings_status_check" CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Cancelled'::character varying])::text[]))) not valid;

alter table "public"."bookings" validate constraint "bookings_status_check";

alter table "public"."bookings" add constraint "bookings_train_id_fkey" FOREIGN KEY (train_id) REFERENCES public.trains(id) ON DELETE RESTRICT not valid;

alter table "public"."bookings" validate constraint "bookings_train_id_fkey";

alter table "public"."passengers" add constraint "passengers_age_check" CHECK (((age >= 1) AND (age <= 120))) not valid;

alter table "public"."passengers" validate constraint "passengers_age_check";

alter table "public"."passengers" add constraint "passengers_contact_check" CHECK (((contact)::text ~ '^[0-9]{10}$'::text)) not valid;

alter table "public"."passengers" validate constraint "passengers_contact_check";

alter table "public"."passengers" add constraint "passengers_email_key" UNIQUE using index "passengers_email_key";

alter table "public"."passengers" add constraint "passengers_gender_check" CHECK (((gender)::text = ANY ((ARRAY['Male'::character varying, 'Female'::character varying])::text[]))) not valid;

alter table "public"."passengers" validate constraint "passengers_gender_check";

alter table "public"."revenue" add constraint "revenue_cancellations_check" CHECK ((cancellations >= 0)) not valid;

alter table "public"."revenue" validate constraint "revenue_cancellations_check";

alter table "public"."revenue" add constraint "revenue_total_bookings_check" CHECK ((total_bookings >= 0)) not valid;

alter table "public"."revenue" validate constraint "revenue_total_bookings_check";

alter table "public"."revenue" add constraint "revenue_total_revenue_check" CHECK ((total_revenue >= (0)::numeric)) not valid;

alter table "public"."revenue" validate constraint "revenue_total_revenue_check";

alter table "public"."routes" add constraint "routes_distance_km_check" CHECK ((distance_km > (0)::numeric)) not valid;

alter table "public"."routes" validate constraint "routes_distance_km_check";

alter table "public"."routes" add constraint "routes_duration_min_check" CHECK ((duration_min > 0)) not valid;

alter table "public"."routes" validate constraint "routes_duration_min_check";

alter table "public"."routes" add constraint "routes_stops_check" CHECK ((array_length(stops, 1) >= 2)) not valid;

alter table "public"."routes" validate constraint "routes_stops_check";

alter table "public"."schedules" add constraint "schedules_delay_minutes_check" CHECK (((delay_minutes >= 0) AND (delay_minutes <= 999))) not valid;

alter table "public"."schedules" validate constraint "schedules_delay_minutes_check";

alter table "public"."schedules" add constraint "schedules_platform_check" CHECK (((platform >= 1) AND (platform <= 20))) not valid;

alter table "public"."schedules" validate constraint "schedules_platform_check";

alter table "public"."schedules" add constraint "schedules_train_id_date_key" UNIQUE using index "schedules_train_id_date_key";

alter table "public"."schedules" add constraint "schedules_train_id_fkey" FOREIGN KEY (train_id) REFERENCES public.trains(id) ON DELETE CASCADE not valid;

alter table "public"."schedules" validate constraint "schedules_train_id_fkey";

alter table "public"."trains" add constraint "trains_check" CHECK ((seats_available <= seats_total)) not valid;

alter table "public"."trains" validate constraint "trains_check";

alter table "public"."trains" add constraint "trains_check1" CHECK (((from_city)::text <> (to_city)::text)) not valid;

alter table "public"."trains" validate constraint "trains_check1";

alter table "public"."trains" add constraint "trains_fare_business_check" CHECK ((fare_business >= (0)::numeric)) not valid;

alter table "public"."trains" validate constraint "trains_fare_business_check";

alter table "public"."trains" add constraint "trains_fare_economy_check" CHECK ((fare_economy >= (0)::numeric)) not valid;

alter table "public"."trains" validate constraint "trains_fare_economy_check";

alter table "public"."trains" add constraint "trains_seats_available_check" CHECK ((seats_available >= 0)) not valid;

alter table "public"."trains" validate constraint "trains_seats_available_check";

alter table "public"."trains" add constraint "trains_seats_total_check" CHECK ((seats_total > 0)) not valid;

alter table "public"."trains" validate constraint "trains_seats_total_check";

alter table "public"."trains" add constraint "trains_status_check" CHECK (((status)::text = ANY ((ARRAY['On Time'::character varying, 'Delayed'::character varying, 'Full'::character varying])::text[]))) not valid;

alter table "public"."trains" validate constraint "trains_status_check";

alter table "public"."users" add constraint "users_passenger_id_fkey" FOREIGN KEY (passenger_id) REFERENCES public.passengers(id) ON DELETE SET NULL not valid;

alter table "public"."users" validate constraint "users_passenger_id_fkey";

alter table "public"."users" add constraint "users_role_check" CHECK (((role)::text = ANY ((ARRAY['Admin'::character varying, 'Staff'::character varying, 'Passenger'::character varying])::text[]))) not valid;

alter table "public"."users" validate constraint "users_role_check";

alter table "public"."users" add constraint "users_username_key" UNIQUE using index "users_username_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  found_count integer;
BEGIN
  SELECT count(*) INTO found_count
  FROM   public.users
  WHERE  username = lower(trim(p_username));

  RETURN found_count = 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_user(p_username text, p_password text, p_role text, p_display_name text, p_passenger_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow creating Passenger accounts via this function.
  -- Admin/Staff accounts must be created manually by a DB admin.
  IF p_role <> 'Passenger' THEN
    RAISE EXCEPTION 'Only Passenger accounts may be created via signup';
  END IF;

  INSERT INTO public.users (username, password, role, display_name, passenger_id)
  VALUES (lower(trim(p_username)), p_password, p_role, p_display_name, p_passenger_id);

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_login(p_username text, p_password text)
 RETURNS TABLE(username text, role text, display_name text, passenger_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.username::text, u.role::text, u.display_name::text, u.passenger_id::text
  FROM   public.users u
  WHERE  u.username = lower(trim(p_username))
    AND  u.password = p_password
  LIMIT  1;
END;
$function$
;

grant delete on table "public"."bookings" to "anon";

grant insert on table "public"."bookings" to "anon";

grant references on table "public"."bookings" to "anon";

grant select on table "public"."bookings" to "anon";

grant trigger on table "public"."bookings" to "anon";

grant truncate on table "public"."bookings" to "anon";

grant update on table "public"."bookings" to "anon";

grant delete on table "public"."bookings" to "authenticated";

grant insert on table "public"."bookings" to "authenticated";

grant references on table "public"."bookings" to "authenticated";

grant select on table "public"."bookings" to "authenticated";

grant trigger on table "public"."bookings" to "authenticated";

grant truncate on table "public"."bookings" to "authenticated";

grant update on table "public"."bookings" to "authenticated";

grant delete on table "public"."bookings" to "service_role";

grant insert on table "public"."bookings" to "service_role";

grant references on table "public"."bookings" to "service_role";

grant select on table "public"."bookings" to "service_role";

grant trigger on table "public"."bookings" to "service_role";

grant truncate on table "public"."bookings" to "service_role";

grant update on table "public"."bookings" to "service_role";

grant delete on table "public"."passengers" to "anon";

grant insert on table "public"."passengers" to "anon";

grant references on table "public"."passengers" to "anon";

grant select on table "public"."passengers" to "anon";

grant trigger on table "public"."passengers" to "anon";

grant truncate on table "public"."passengers" to "anon";

grant update on table "public"."passengers" to "anon";

grant delete on table "public"."passengers" to "authenticated";

grant insert on table "public"."passengers" to "authenticated";

grant references on table "public"."passengers" to "authenticated";

grant select on table "public"."passengers" to "authenticated";

grant trigger on table "public"."passengers" to "authenticated";

grant truncate on table "public"."passengers" to "authenticated";

grant update on table "public"."passengers" to "authenticated";

grant delete on table "public"."passengers" to "service_role";

grant insert on table "public"."passengers" to "service_role";

grant references on table "public"."passengers" to "service_role";

grant select on table "public"."passengers" to "service_role";

grant trigger on table "public"."passengers" to "service_role";

grant truncate on table "public"."passengers" to "service_role";

grant update on table "public"."passengers" to "service_role";

grant delete on table "public"."revenue" to "anon";

grant insert on table "public"."revenue" to "anon";

grant references on table "public"."revenue" to "anon";

grant select on table "public"."revenue" to "anon";

grant trigger on table "public"."revenue" to "anon";

grant truncate on table "public"."revenue" to "anon";

grant update on table "public"."revenue" to "anon";

grant delete on table "public"."revenue" to "authenticated";

grant insert on table "public"."revenue" to "authenticated";

grant references on table "public"."revenue" to "authenticated";

grant select on table "public"."revenue" to "authenticated";

grant trigger on table "public"."revenue" to "authenticated";

grant truncate on table "public"."revenue" to "authenticated";

grant update on table "public"."revenue" to "authenticated";

grant delete on table "public"."revenue" to "service_role";

grant insert on table "public"."revenue" to "service_role";

grant references on table "public"."revenue" to "service_role";

grant select on table "public"."revenue" to "service_role";

grant trigger on table "public"."revenue" to "service_role";

grant truncate on table "public"."revenue" to "service_role";

grant update on table "public"."revenue" to "service_role";

grant delete on table "public"."routes" to "anon";

grant insert on table "public"."routes" to "anon";

grant references on table "public"."routes" to "anon";

grant select on table "public"."routes" to "anon";

grant trigger on table "public"."routes" to "anon";

grant truncate on table "public"."routes" to "anon";

grant update on table "public"."routes" to "anon";

grant delete on table "public"."routes" to "authenticated";

grant insert on table "public"."routes" to "authenticated";

grant references on table "public"."routes" to "authenticated";

grant select on table "public"."routes" to "authenticated";

grant trigger on table "public"."routes" to "authenticated";

grant truncate on table "public"."routes" to "authenticated";

grant update on table "public"."routes" to "authenticated";

grant delete on table "public"."routes" to "service_role";

grant insert on table "public"."routes" to "service_role";

grant references on table "public"."routes" to "service_role";

grant select on table "public"."routes" to "service_role";

grant trigger on table "public"."routes" to "service_role";

grant truncate on table "public"."routes" to "service_role";

grant update on table "public"."routes" to "service_role";

grant delete on table "public"."schedules" to "anon";

grant insert on table "public"."schedules" to "anon";

grant references on table "public"."schedules" to "anon";

grant select on table "public"."schedules" to "anon";

grant trigger on table "public"."schedules" to "anon";

grant truncate on table "public"."schedules" to "anon";

grant update on table "public"."schedules" to "anon";

grant delete on table "public"."schedules" to "authenticated";

grant insert on table "public"."schedules" to "authenticated";

grant references on table "public"."schedules" to "authenticated";

grant select on table "public"."schedules" to "authenticated";

grant trigger on table "public"."schedules" to "authenticated";

grant truncate on table "public"."schedules" to "authenticated";

grant update on table "public"."schedules" to "authenticated";

grant delete on table "public"."schedules" to "service_role";

grant insert on table "public"."schedules" to "service_role";

grant references on table "public"."schedules" to "service_role";

grant select on table "public"."schedules" to "service_role";

grant trigger on table "public"."schedules" to "service_role";

grant truncate on table "public"."schedules" to "service_role";

grant update on table "public"."schedules" to "service_role";

grant delete on table "public"."trains" to "anon";

grant insert on table "public"."trains" to "anon";

grant references on table "public"."trains" to "anon";

grant select on table "public"."trains" to "anon";

grant trigger on table "public"."trains" to "anon";

grant truncate on table "public"."trains" to "anon";

grant update on table "public"."trains" to "anon";

grant delete on table "public"."trains" to "authenticated";

grant insert on table "public"."trains" to "authenticated";

grant references on table "public"."trains" to "authenticated";

grant select on table "public"."trains" to "authenticated";

grant trigger on table "public"."trains" to "authenticated";

grant truncate on table "public"."trains" to "authenticated";

grant update on table "public"."trains" to "authenticated";

grant delete on table "public"."trains" to "service_role";

grant insert on table "public"."trains" to "service_role";

grant references on table "public"."trains" to "service_role";

grant select on table "public"."trains" to "service_role";

grant trigger on table "public"."trains" to "service_role";

grant truncate on table "public"."trains" to "service_role";

grant update on table "public"."trains" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


  create policy "anon full access"
  on "public"."bookings"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "anon full access"
  on "public"."passengers"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "anon full access"
  on "public"."revenue"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "anon full access"
  on "public"."routes"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "anon full access"
  on "public"."schedules"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "anon full access"
  on "public"."trains"
  as permissive
  for all
  to anon
using (true)
with check (true);



