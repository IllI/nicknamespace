-- Error logging table for monitoring and analytics
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  error_code text NOT NULL,
  error_message text NOT NULL,
  user_message text NOT NULL,
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL DEFAULT 'medium',
  context jsonb DEFAULT '{}',
  user_id uuid REFERENCES auth.users,
  job_id uuid,
  operation text,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at timestamp with time zone,
  resolution_notes text
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_code ON error_logs(error_code);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_job_id ON error_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_operation ON error_logs(operation);

-- RLS policies
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own errors
CREATE POLICY "Users can view their own errors" ON error_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all errors
CREATE POLICY "Service role can manage all errors" ON error_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to clean up old error logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM error_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Create a scheduled job to run cleanup weekly (if pg_cron is available)
-- SELECT cron.schedule('cleanup-error-logs', '0 2 * * 0', 'SELECT cleanup_old_error_logs();');