-- Manual Database Setup for 3D Conversion
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/syrhaykzsknfitgithmn/sql

-- 1. Create user_usage table (most critical for current error)
CREATE TABLE IF NOT EXISTS user_usage (
  user_id uuid REFERENCES auth.users PRIMARY KEY,
  daily_conversions integer DEFAULT 0,
  monthly_conversions integer DEFAULT 0,
  total_api_cost numeric(10,4) DEFAULT 0,
  last_conversion_date date,
  subscription_tier text CHECK (subscription_tier IN ('free', 'premium', 'enterprise')) DEFAULT 'free',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create conversion_records table
CREATE TABLE IF NOT EXISTS conversion_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  original_image_url text,
  model_file_url text,
  status text CHECK (status IN ('uploading', 'processing', 'completed', 'failed')) DEFAULT 'uploading',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone,
  error_message text,
  file_sizes jsonb DEFAULT '{}',
  model_metadata jsonb DEFAULT '{}',
  print_metadata jsonb DEFAULT '{}'
);

-- 3. Enable RLS on both tables
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_records ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for user_usage
CREATE POLICY "Users can view own usage data" ON user_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage data" ON user_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage data" ON user_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Create policies for conversion_records
CREATE POLICY "Users can view own conversion records" ON conversion_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversion records" ON conversion_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversion records" ON conversion_records
  FOR UPDATE USING (auth.uid() = user_id);

-- 6. Create admin user usage record (replace with your actual admin user ID)
INSERT INTO user_usage (
  user_id, 
  daily_conversions, 
  monthly_conversions, 
  total_api_cost, 
  subscription_tier,
  last_conversion_date
) VALUES (
  'fbb9f3b1-e69c-4682-8fbd-1494bb723b0e'::uuid, -- Admin user ID from our script
  0, 
  0, 
  0.0, 
  'enterprise',
  CURRENT_DATE
) ON CONFLICT (user_id) DO UPDATE SET
  subscription_tier = 'enterprise',
  updated_at = now();

-- 7. Create function to increment conversion count
CREATE OR REPLACE FUNCTION public.increment_user_conversion(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO user_usage (user_id, daily_conversions, monthly_conversions, last_conversion_date)
  VALUES (p_user_id, 1, 1, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET
    daily_conversions = CASE 
      WHEN user_usage.last_conversion_date = CURRENT_DATE 
      THEN user_usage.daily_conversions + 1
      ELSE 1
    END,
    monthly_conversions = user_usage.monthly_conversions + 1,
    last_conversion_date = CURRENT_DATE,
    updated_at = timezone('utc'::text, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create storage buckets (run these one by one if they fail)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('conversion-images', 'conversion-images', false, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('3d-models-raw', '3d-models-raw', false, 52428800, ARRAY['application/octet-stream', 'model/ply', 'model/obj'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('3d-models-print-ready', '3d-models-print-ready', false, 52428800, ARRAY['application/octet-stream', 'model/stl', 'model/obj'])
ON CONFLICT (id) DO NOTHING;

-- 9. Create storage policies for conversion-images bucket
CREATE POLICY "Users can upload their own images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'conversion-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'conversion-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Success message
SELECT 'Database setup completed successfully!' as message;