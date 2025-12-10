// Script to create an admin super user for testing
const { createClient } = require('@supabase/supabase-js');
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

async function createAdminUser() {
  console.log('🔧 Creating admin super user...\n');

  const adminCredentials = {
    email: 'admin@3dconversion.test',
    password: 'Admin123!@#',
    role: 'admin'
  };

  try {
    // Step 1: Create the user in Supabase Auth
    console.log('1. Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminCredentials.email,
      password: adminCredentials.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: 'Admin User',
        role: 'admin'
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('   ⚠️  User already exists, continuing...');
        
        // Get existing user
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        const existingUser = users.users.find(u => u.email === adminCredentials.email);
        if (!existingUser) throw new Error('User exists but could not be found');
        
        authData.user = existingUser;
      } else {
        throw authError;
      }
    } else {
      console.log('   ✅ User created successfully');
    }

    const userId = authData.user.id;
    console.log(`   📧 Email: ${adminCredentials.email}`);
    console.log(`   🆔 User ID: ${userId}`);

    // Step 2: Create user details record
    console.log('\n2. Creating user details...');
    const { error: detailsError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        full_name: 'Admin User',
        avatar_url: null,
        billing_address: null,
        payment_method: null
      });

    if (detailsError && !detailsError.message.includes('duplicate key')) {
      console.log('   ⚠️  User details error (may already exist):', detailsError.message);
    } else {
      console.log('   ✅ User details created');
    }

    // Step 3: Create user usage record for 3D conversion
    console.log('\n3. Creating 3D conversion usage record...');
    const { error: usageError } = await supabase
      .from('user_usage')
      .upsert({
        user_id: userId,
        daily_conversions: 0,
        monthly_conversions: 0,
        total_api_cost: 0.0,
        subscription_tier: 'enterprise', // Give admin enterprise tier
        last_conversion_date: new Date().toISOString()
      });

    if (usageError && !usageError.message.includes('duplicate key')) {
      console.log('   ⚠️  Usage record error (may already exist):', usageError.message);
    } else {
      console.log('   ✅ Usage record created with enterprise tier');
    }

    // Step 4: Create a customer record for Stripe (if needed)
    console.log('\n4. Creating customer record...');
    const { error: customerError } = await supabase
      .from('customers')
      .upsert({
        id: userId,
        stripe_customer_id: null
      });

    if (customerError && !customerError.message.includes('duplicate key')) {
      console.log('   ⚠️  Customer record error (may already exist):', customerError.message);
    } else {
      console.log('   ✅ Customer record created');
    }

    // Success message
    console.log('\n🎉 Admin user created successfully!\n');
    console.log('📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email:    ${adminCredentials.email}`);
    console.log(`🔑 Password: ${adminCredentials.password}`);
    console.log(`🏷️  Tier:     Enterprise (unlimited conversions)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🚀 Next Steps:');
    console.log('1. Go to http://localhost:3001');
    console.log('2. Click "Sign In"');
    console.log('3. Use the credentials above');
    console.log('4. Navigate to "3D Conversion" to test the feature');
    console.log('5. Check "Account" page to see enterprise tier benefits\n');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the script
createAdminUser();