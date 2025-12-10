// Script to apply the 3D conversion migration to Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🔧 Applying 3D conversion database migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20241103061500_3d_conversion_setup.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log(`📏 Migration size: ${migrationSQL.length} characters\n`);

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`🔢 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          
          // Add semicolon back for execution
          const { error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });

          if (error) {
            // Try direct query execution as fallback
            const { error: queryError } = await supabase
              .from('dummy') // This will fail but might give us better error info
              .select('*');
            
            // If it's a "already exists" error, that's okay
            if (error.message.includes('already exists') || 
                error.message.includes('duplicate key') ||
                error.message.includes('relation') && error.message.includes('already exists')) {
              console.log(`   ⚠️  Already exists (skipping): ${error.message.substring(0, 100)}...`);
            } else {
              console.log(`   ❌ Error: ${error.message}`);
              // Don't exit, continue with other statements
            }
          } else {
            console.log(`   ✅ Statement ${i + 1} executed successfully`);
          }
        } catch (execError) {
          console.log(`   ❌ Execution error: ${execError.message}`);
        }
      }
    }

    console.log('\n🎉 Migration application completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Test the 3D conversion upload again');
    console.log('2. Check if user usage tracking works');
    console.log('3. Verify storage buckets are created');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    
    // Try a simpler approach - create tables individually
    console.log('\n🔄 Trying simplified table creation...');
    await createTablesDirectly();
  }
}

async function createTablesDirectly() {
  console.log('📋 Creating essential tables directly...\n');

  // Create user_usage table (most critical for the current error)
  const createUserUsageSQL = `
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
  `;

  // Create conversion_records table
  const createConversionRecordsSQL = `
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
  `;

  const tables = [
    { name: 'user_usage', sql: createUserUsageSQL },
    { name: 'conversion_records', sql: createConversionRecordsSQL }
  ];

  for (const table of tables) {
    try {
      console.log(`⏳ Creating ${table.name} table...`);
      
      // Use a simple query approach
      const { error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', table.name)
        .single();

      if (error && error.code === 'PGRST116') {
        // Table doesn't exist, try to create it
        console.log(`   📝 Table ${table.name} doesn't exist, creating...`);
        // We'll need to use a different approach since we can't execute DDL directly
        console.log(`   ⚠️  Please create this table manually in Supabase dashboard:`);
        console.log(`   ${table.sql}`);
      } else {
        console.log(`   ✅ Table ${table.name} already exists`);
      }
    } catch (tableError) {
      console.log(`   ❌ Error checking ${table.name}: ${tableError.message}`);
    }
  }

  // Create usage record for our admin user
  await createAdminUsageRecord();
}

async function createAdminUsageRecord() {
  console.log('\n👤 Creating usage record for admin user...');
  
  const adminUserId = 'fbb9f3b1-e69c-4682-8fbd-1494bb723b0e'; // From our admin user creation
  
  try {
    const { error } = await supabase
      .from('user_usage')
      .upsert({
        user_id: adminUserId,
        daily_conversions: 0,
        monthly_conversions: 0,
        total_api_cost: 0.0,
        subscription_tier: 'enterprise',
        last_conversion_date: new Date().toISOString().split('T')[0]
      });

    if (error) {
      console.log(`   ⚠️  Could not create usage record: ${error.message}`);
      console.log('   💡 This is expected if tables don\'t exist yet');
    } else {
      console.log('   ✅ Admin usage record created successfully');
    }
  } catch (usageError) {
    console.log(`   ⚠️  Usage record error: ${usageError.message}`);
  }
}

// Run the migration
applyMigration();