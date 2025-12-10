-- Add printer configuration fields to direct_print_jobs table

-- Add printer IP and serial columns with defaults
ALTER TABLE direct_print_jobs 
ADD COLUMN IF NOT EXISTS printer_ip text DEFAULT '192.168.1.129',
ADD COLUMN IF NOT EXISTS printer_serial text DEFAULT '01P09A3A1800831',
ADD COLUMN IF NOT EXISTS printer_access_code text;

-- Add indexes for printer fields
CREATE INDEX IF NOT EXISTS idx_direct_print_jobs_printer_ip ON direct_print_jobs(printer_ip);
CREATE INDEX IF NOT EXISTS idx_direct_print_jobs_printer_serial ON direct_print_jobs(printer_serial);

-- Update the update_direct_print_job_status function to handle printer fields
CREATE OR REPLACE FUNCTION public.update_direct_print_job_status(
  p_job_id uuid,
  p_status text,
  p_error_message text DEFAULT NULL,
  p_print_service_response jsonb DEFAULT NULL,
  p_printer_ip text DEFAULT NULL,
  p_printer_serial text DEFAULT NULL
)
RETURNS void AS $
BEGIN
  UPDATE direct_print_jobs 
  SET 
    status = p_status,
    error_message = p_error_message,
    print_service_response = COALESCE(p_print_service_response, print_service_response),
    printer_ip = COALESCE(p_printer_ip, printer_ip),
    printer_serial = COALESCE(p_printer_serial, printer_serial),
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

-- Update existing jobs to have the default printer IP
UPDATE direct_print_jobs 
SET 
  printer_ip = '192.168.1.129',
  printer_serial = '01P09A3A1800831'
WHERE printer_ip IS NULL OR printer_serial IS NULL;