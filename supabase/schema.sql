-- ==============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) SCHEMA & POLICIES FOR CAFE ORDERING
-- ==============================================================================

-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  image_url TEXT,
  category_id TEXT NOT NULL,
  category_name TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  popular BOOLEAN DEFAULT false,
  top_pick BOOLEAN DEFAULT false,
  house_special BOOLEAN DEFAULT false,
  prep_time_minutes INTEGER DEFAULT 5,
  calories INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_name TEXT,
  icon_emoji TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 4. PUBLIC CUSTOMER READ POLICIES (anon key)
-- Public customers can ONLY read products that are currently in stock (is_available = true)
DROP POLICY IF EXISTS "Public customer can only view available products" ON public.products;
CREATE POLICY "Public customer can only view available products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_available = true);

-- Public customers can view all categories
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (true);

-- 5. ADMIN / SERVICE ROLE WRITE POLICIES
-- Only the backend server using the Supabase Service Role key (or verified admin role)
-- can mutate products (change is_available, price, description, popular, etc.)
DROP POLICY IF EXISTS "Service role full access on products" ON public.products;
CREATE POLICY "Service role full access on products"
ON public.products
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on categories" ON public.categories;
CREATE POLICY "Service role full access on categories"
ON public.categories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Realtime Publication for Live Client Sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
