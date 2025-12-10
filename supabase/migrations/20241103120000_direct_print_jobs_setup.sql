-- Direct 3D Model Printing Service Setup Migration

-- Create storage bucket for direct 3D model uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('direct-3d-models', 'direct-3d-models', false, 52428800, ARRAY['application/octet-stream', 'model/stl', 'model/obj', 'model/ply'])
ON CONFLICT (id) DO NOTHING;

-- Create direct_print_jobs table for tracking direct model uploads and print jobs
CREATE TABLE IF NOT EXISTS direct_print_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  file_size_bytes bigint NOT NULL,
  status text CHECK (status IN ('pending', 'downloading', 'slicing', 'uploading', 'printing', 'complete', 'failed', 'cleanup_pending')) DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  submitted_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  print_service_response jsonb,
  model_metadata jsonb DEFAULT '{}',
  print_settings jsonb DEFAULT '{}',
  estimated_duration_minutes integer,
  webhook_url text,
  webhook_attempts integer DEFAULT 0,
  last_webhook_attempt timestamp with time zone
);

-- Enable RLS on direct_print_jobs
ALTER TABLE direct_print_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for direct_print_jobs
CREATE POLICY "Users can view own direct print jobs" ON direct_print_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own direct print jobs" ON direct_print_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own direct print jobs" ON direct_print_jobs
  FOR UPDATE USING (auth.uid() = user_id);

-- Create storage policies for direct-3d-models bucket
CREATE POLICY "Users can upload their own direct 3D models" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'direct-3d-models' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own direct 3D models" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'direct-3d-models' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own direct 3D models" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'direct-3d-models' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_direct_print_jobs_user_id ON direct_print_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_direct_print_jobs_status ON direct_print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_direct_print_jobs_created_at ON direct_print_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_direct_print_jobs_submitted_at ON direct_print_jobs(submitted_at);

-- Function to update job status with timestamp tracking
CREATE OR REPLACE FUNCTION public.update_direct_print_job_status(
  p_job_id uuid,
  p_status text,
  p_error_message text DEFAULT NULL,
  p_print_service_response jsonb DEFAULT NULL
)
RETURNS void AS $
BEGIN
  UPDATE direct_print_jobs 
  SET 
    status = p_status,
    error_message = p_error_message,
    print_service_response = COALESCE(p_print_service_response, print_service_response),
    submitted_at = CASE 
      WHEN p_status IN ('downloading', 'slicing', 'uploading', 'printing') AND submitted_at IS NULL 
      THEN timezone('utc'::text, now())
      ELSE submitted_at
    END,
    completed_at = CASE 
      WHEN p_status IN ('complete', 'failed') 
      THEN timezone('utc'::text, now())
      ELSE completed_at
    END
  WHERE id = p_job_id AND user_id = auth.uid();
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old failed job files (to be called by a cron job)
CREATE OR REPLACE FUNCTION public.cleanup_failed_direct_print_jobs()
RETURNS void AS $
BEGIN
  -- Mark files for cleanup that are older than 7 days and failed
  UPDATE direct_print_jobs 
  SET status = 'cleanup_pending'
  WHERE status = 'failed' 
    AND created_at < (timezone('utc'::text, now()) - INTERVAL '7 days');
    
  -- Note: Actual file deletion should be handled by a separate process
  -- that reads cleanup_pending jobs and removes files from storage
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user storage usage for direct print jobs
CREATE OR REPLACE FUNCTION public.get_user_direct_print_storage_usage(p_user_id uuid)
RETURNS TABLE(
  total_files bigint,
  total_size_bytes bigint,
  active_jobs bigint,
  completed_jobs bigint,
  failed_jobs bigint
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_files,
    COALESCE(SUM(file_size_bytes), 0)::bigint as total_size_bytes,
    COUNT(CASE WHEN status IN ('pending', 'downloading', 'slicing', 'uploading', 'printing') THEN 1 END)::bigint as active_jobs,
    COUNT(CASE WHEN status = 'complete' THEN 1 END)::bigint as completed_jobs,
    COUNT(CASE WHEN status = 'failed' THEN 1 END)::bigint as failed_jobs
  FROM direct_print_jobs 
  WHERE user_id = p_user_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can upload more files (storage quota enforcement)
CREATE OR REPLACE FUNCTION public.check_direct_print_upload_quota(
  p_user_id uuid,
  p_file_size_bytes bigint
)
RETURNS TABLE(
  can_upload boolean,
  current_usage_bytes bigint,
  quota_limit_bytes bigint,
  reason text
) AS $
DECLARE
  v_current_usage bigint;
  v_quota_limit bigint;
  v_user_tier text;
BEGIN
  -- Get user's subscription tier (default to free if not found)
  SELECT COALESCE(subscription_tier, 'free') INTO v_user_tier
  FROM user_usage 
  WHERE user_id = p_user_id;
  
  -- Set quota limits based on tier
  v_quota_limit := CASE v_user_tier
    WHEN 'free' THEN 1073741824      -- 1GB
    WHEN 'premium' THEN 5368709120   -- 5GB  
    WHEN 'enterprise' THEN 21474836480 -- 20GB
    ELSE 1073741824                  -- Default to free tier
  END;
  
  -- Get current usage
  SELECT COALESCE(SUM(file_size_bytes), 0) INTO v_current_usage
  FROM direct_print_jobs 
  WHERE user_id = p_user_id 
    AND status NOT IN ('failed', 'cleanup_pending');
  
  -- Check if upload would exceed quota
  RETURN QUERY
  SELECT 
    (v_current_usage + p_file_size_bytes) <= v_quota_limit as can_upload,
    v_current_usage as current_usage_bytes,
    v_quota_limit as quota_limit_bytes,
    CASE 
      WHEN (v_current_usage + p_file_size_bytes) > v_quota_limit 
      THEN 'Storage quota exceeded. Upgrade your plan or delete old files.'
      ELSE 'Upload allowed'
    END as reason;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record webhook attempt
CREATE OR REPLACE FUNCTION public.record_webhook_attempt(
  p_job_id uuid,
  p_success boolean DEFAULT false
)
RETURNS void AS $
BEGIN
  UPDATE direct_print_jobs 
  SET 
    webhook_attempts = COALESCE(webhook_attempts, 0) + 1,
    last_webhook_attempt = timezone('utc'::text, now())
  WHERE id = p_job_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get jobs that need webhook notifications
CREATE OR REPLACE FUNCTION public.get_jobs_needing_webhook_notification()
RETURNS TABLE(
  id uuid,
  webhook_url text,
  status text,
  filename text,
  storage_path text,
  error_message text,
  created_at timestamp with time zone,
  submitted_at timestamp with time zone,
  completed_at timestamp with time zone,
  webhook_attempts integer
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    dpj.id,
    dpj.webhook_url,
    dpj.status,
    dpj.filename,
    dpj.storage_path,
    dpj.error_message,
    dpj.created_at,
    dpj.submitted_at,
    dpj.completed_at,
    COALESCE(dpj.webhook_attempts, 0) as webhook_attempts
  FROM direct_print_jobs dpj
  WHERE dpj.webhook_url IS NOT NULL
    AND COALESCE(dpj.webhook_attempts, 0) < 3  -- Max 3 attempts
    AND (
      dpj.last_webhook_attempt IS NULL 
      OR dpj.last_webhook_attempt < (timezone('utc'::text, now()) - INTERVAL '5 minutes')
    )
  ORDER BY dpj.created_at ASC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;