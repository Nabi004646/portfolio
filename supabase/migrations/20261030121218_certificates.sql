-- Apply after 20261030121214_portfolio.sql, including on existing projects.
alter table public.content_items drop constraint if exists content_items_kind_check;
alter table public.content_items add constraint content_items_kind_check
  check (kind in ('settings', 'home', 'about', 'skills', 'contact', 'page', 'project', 'post', 'certificate'));
-- Certificates inherit the existing published-read / allowlisted-AAL2-write
-- policies and content audit trigger. No public write access is introduced.
