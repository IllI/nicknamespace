# Admin User Setup Instructions

Since we're having network connectivity issues with the automated script, here's how to manually create an admin user for testing:

## Option 1: Manual Supabase Dashboard Setup

### Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Sign in to your account
3. Select your project: `streaqylktsczflxciwwn`

### Step 2: Create User in Authentication
1. Go to **Authentication** → **Users** in the sidebar
2. Click **Add User** button
3. Fill in the details:
   - **Email**: `admin@3dconversion.test`
   - **Password**: `Admin123!@#`
   - **Auto Confirm User**: ✅ (check this box)
   - **User Metadata** (optional): `{"role": "admin", "full_name": "Admin User"}`
4. Click **Create User**

### Step 3: Add User to Database Tables
1. Go to **Table Editor** in the sidebar
2. Select the `users` table
3. Click **Insert** → **Insert row**
4. Fill in:
   - **id**: (copy the user ID from the Authentication page)
   - **full_name**: `Admin User`
   - Leave other fields as null
5. Click **Save**

### Step 4: Create Usage Record
1. Still in **Table Editor**, select the `user_usage` table
2. Click **Insert** → **Insert row**
3. Fill in:
   - **user_id**: (same user ID as above)
   - **daily_conversions**: `0`
   - **monthly_conversions**: `0`
   - **total_api_cost**: `0.0`
   - **subscription_tier**: `enterprise`
   - **last_conversion_date**: (today's date in ISO format, e.g., `2024-11-03T12:00:00Z`)
4. Click **Save**

## Option 2: Use Existing Credentials (If Available)

If you already have a Supabase account or user, you can use those credentials to sign in and test the 3D conversion feature.

## Option 3: Quick Test User Creation

### Temporary Admin Credentials
**Email**: `admin@3dconversion.test`
**Password**: `Admin123!@#`

### Manual Database Insertion (SQL)
If you have SQL access to your Supabase database, run these commands:

```sql
-- Insert into auth.users (this requires admin access)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data
) VALUES (
  gen_random_uuid(),
  'admin@3dconversion.test',
  crypt('Admin123!@#', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"role": "admin", "full_name": "Admin User"}'::jsonb
);

-- Get the user ID and use it for the following inserts
-- Replace 'USER_ID_HERE' with the actual UUID from the above insert

-- Insert into users table
INSERT INTO users (id, full_name) 
VALUES ('USER_ID_HERE', 'Admin User');

-- Insert into user_usage table
INSERT INTO user_usage (
  user_id, 
  daily_conversions, 
  monthly_conversions, 
  total_api_cost, 
  subscription_tier,
  last_conversion_date
) VALUES (
  'USER_ID_HERE', 
  0, 
  0, 
  0.0, 
  'enterprise',
  now()
);

-- Insert into customers table
INSERT INTO customers (id, stripe_customer_id) 
VALUES ('USER_ID_HERE', null);
```

## Testing the 3D Conversion

Once you have the admin user set up:

1. **Access the Application**
   - Go to http://localhost:3001
   - Click "Sign In"

2. **Login with Admin Credentials**
   - Email: `admin@3dconversion.test`
   - Password: `Admin123!@#`

3. **Test 3D Conversion**
   - Click "3D Conversion" in the navigation
   - Upload a test image (PNG/JPG, max 10MB)
   - Monitor the conversion process

4. **Check Admin Features**
   - Go to "Account" page to see enterprise tier benefits
   - Check conversion history
   - Test different image types

## Troubleshooting

If you encounter issues:
1. Check that the user exists in the Authentication tab
2. Verify the user has records in all required tables
3. Ensure the subscription_tier is set to 'enterprise' for unlimited conversions
4. Check browser console for any JavaScript errors

## Alternative: Sign Up Through UI

If the manual setup is too complex, you can:
1. Go to http://localhost:3001
2. Click "Sign In" → "Sign Up"
3. Create a new account through the UI
4. Manually update the `subscription_tier` to 'enterprise' in the database

This will give you a working user account for testing the 3D conversion functionality.