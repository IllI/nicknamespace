-- 3D Conversion Service Setup Migration

-- Create storage buckets for 3D conversion files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('conversion-images', 'conversion-images', false, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png']),
  ('3d-models-raw', '3d-models-raw', false, 52428800, ARRAY['application/octet-stream', 'model/ply', 'model/obj']),
  ('3d-models-print-ready', '3d-models-print-ready', false, 52428800, ARRAY['application/octet-stream', 'model/stl', 'model/obj'])
ON CONFLICT (id) DO NOTHING;

-- Create conversion_records table
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

-- Enable RLS on conversion_records
ALTER TABLE conversion_records ENABLE ROW LEVEL SECURITY;

-- Create policies for conversion_records
CREATE POLICY "Users can view own conversion records" ON conversion_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversion records" ON conversion_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversion records" ON conversion_records
  FOR UPDATE USING (auth.uid() = user_id);

-- Create user_usage table for tracking limits and analytics
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

-- Enable RLS on user_usage
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for user_usage
CREATE POLICY "Users can view own usage data" ON user_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage data" ON user_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage data" ON user_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- Create storage policies for conversion-images bucket
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

CREATE POLICY "Users can delete their own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'conversion-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create storage policies for 3d-models-raw bucket
CREATE POLICY "Users can upload their own raw models" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = '3d-models-raw' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own raw models" ON storage.objects
  FOR SELECT USING (
    bucket_id = '3d-models-raw' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own raw models" ON storage.objects
  FOR DELETE USING (
    bucket_id = '3d-models-raw' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create storage policies for 3d-models-print-ready bucket
CREATE POLICY "Users can upload their own print-ready models" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = '3d-models-print-ready' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own print-ready models" ON storage.objects
  FOR SELECT USING (
    bucket_id = '3d-models-print-ready' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own print-ready models" ON storage.objects
  FOR DELETE USING (
    bucket_id = '3d-models-print-ready' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversion_records_user_id ON conversion_records(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_records_status ON conversion_records(status);
CREATE INDEX IF NOT EXISTS idx_conversion_records_created_at ON conversion_records(created_at);
CREATE INDEX IF NOT EXISTS idx_user_usage_last_conversion_date ON user_usage(last_conversion_date);

-- Create function to automatically create user_usage record
CREATE OR REPLACE FUNCTION public.handle_new_user_usage() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_usage (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user_usage when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_usage ON auth.users;
CREATE TRIGGER on_auth_user_created_usage
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_usage();

-- Function to reset daily conversion counts (to be called by a cron job)
CREATE OR REPLACE FUNCTION public.reset_daily_conversions()
RETURNS void AS $$
BEGIN
  UPDATE user_usage 
  SET daily_conversions = 0 
  WHERE last_conversion_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment conversion count
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