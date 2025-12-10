-- OrcaSlicer Print Service Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Print Jobs Table
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- File information
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  gcode_path TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  -- Status values: pending, downloading, slicing, uploading, printing, complete, failed
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  downloading_started_at TIMESTAMP WITH TIME ZONE,
  slicing_started_at TIMESTAMP WITH TIME ZONE,
  uploading_started_at TIMESTAMP WITH TIME ZONE,
  printing_started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  
  -- Printer information
  printer_ip TEXT DEFAULT '192.168.1.129',
  printer_serial TEXT DEFAULT '01P09A3A1800831',
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  file_size_bytes BIGINT,
  estimated_print_time_minutes INTEGER,
  filament_used_grams DECIMAL(10,2),
  
  -- User tracking (optional - if you add auth later)
  user_id UUID,
  
  -- Webhook URL for real-time status updates
  webhook_url TEXT,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'downloading', 'slicing', 'uploading', 'printing', 'complete', 'failed')
  )
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_user_id ON print_jobs(user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_print_jobs_updated_at
  BEFORE UPDATE ON print_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for 3D model files (run this in Supabase Storage UI or via SQL)
-- This creates the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('3d-models', '3d-models', false)
ON CONFLICT (id) DO NOTHING;

-- Also create the legacy bucket for backward compatibility
INSERT INTO storage.buckets (id, name, public)
VALUES ('stl-files', 'stl-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (allow authenticated users to upload)
CREATE POLICY "Allow authenticated uploads to 3d-models"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = '3d-models');

CREATE POLICY "Allow authenticated uploads to stl-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'stl-files');

CREATE POLICY "Allow service role to read 3d-models"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = '3d-models');

CREATE POLICY "Allow service role to read stl-files"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'stl-files');

CREATE POLICY "Allow service role to delete 3d-models"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = '3d-models');

CREATE POLICY "Allow service role to delete stl-files"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'stl-files');

-- Row Level Security (RLS) for print_jobs table
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own jobs (if you add auth)
CREATE POLICY "Users can view own jobs"
ON print_jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Service role can do everything
CREATE POLICY "Service role full access"
ON print_jobs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Anon can insert (for testing - remove in production)
CREATE POLICY "Anon can insert jobs"
ON print_jobs FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Anon can view all (for testing - remove in production)
CREATE POLICY "Anon can view all jobs"
ON print_jobs FOR SELECT
TO anon
USING (true);

-- View for job statistics
CREATE OR REPLACE VIEW print_job_stats AS
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_duration_minutes
FROM print_jobs
WHERE completed_at IS NOT NULL
GROUP BY status;

-- Function to get recent jobs
CREATE OR REPLACE FUNCTION get_recent_jobs(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  filename TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  duration_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pj.id,
    pj.filename,
    pj.status,
    pj.created_at,
    EXTRACT(EPOCH FROM (COALESCE(pj.completed_at, NOW()) - pj.created_at))/60 as duration_minutes
  FROM print_jobs pj
  ORDER BY pj.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE print_jobs IS 'Tracks 3D print jobs from upload to completion';
COMMENT ON COLUMN print_jobs.status IS 'Current status: pending, downloading, slicing, uploading, printing, complete, failed';
COMMENT ON COLUMN print_jobs.storage_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN print_jobs.gcode_path IS 'Local path to generated G-code file';
