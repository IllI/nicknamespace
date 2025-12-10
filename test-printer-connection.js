#!/usr/bin/env node

/**
 * Test Printer Connection Script
 * Tests connectivity to the Bambu Lab printer at the configured IP
 */

require('dotenv').config({ path: '.env.local' });

const PRINTER_IP = process.env.DEFAULT_PRINTER_IP || '192.168.1.129';
const ACCESS_CODE = process.env.BAMBU_ACCESS_CODE || 'default-access-code';

async function testPrinterConnection() {
  console.log('🔌 Testing Bambu Lab Printer Connection...');
  console.log(`   IP Address: ${PRINTER_IP}`);
  console.log(`   Access Code: ${ACCESS_CODE ? '[SET]' : '[NOT SET]'}`);
  console.log('');

  try {
    // Test basic HTTP connectivity
    console.log('1️⃣ Testing basic connectivity...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`http://${PRINTER_IP}/api/version`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ACCESS_CODE}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log('✅ Basic connectivity: SUCCESS');
        
        try {
          const data = await response.json();
          console.log('📋 Printer Response:', JSON.stringify(data, null, 2));
        } catch (jsonError) {
          console.log('✅ Connected, but response is not JSON (this might be normal)');
        }
      } else {
        console.log(`⚠️  Basic connectivity: HTTP ${response.status} - ${response.statusText}`);
        console.log('   This might indicate authentication issues or wrong API endpoint');
      }

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.log('❌ Basic connectivity: TIMEOUT (5 seconds)');
        console.log('   The printer is not responding. Check:');
        console.log('   • Is the printer powered on?');
        console.log('   • Is the IP address correct?');
        console.log('   • Are you on the same network?');
      } else {
        console.log(`❌ Basic connectivity: ${fetchError.message}`);
        console.log('   Network error. Check:');
        console.log('   • Network connectivity');
        console.log('   • Firewall settings');
        console.log('   • Printer network configuration');
      }
    }

    // Test via our API
    console.log('\n2️⃣ Testing via Next.js API...');
    
    try {
      const apiResponse = await fetch('http://localhost:3000/api/3d-printing/test-printer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printer_ip: PRINTER_IP,
          access_code: ACCESS_CODE
        })
      });

      const apiData = await apiResponse.json();
      
      if (apiData.success) {
        console.log('✅ API Test: SUCCESS');
        if (apiData.printer_info) {
          console.log('📋 Printer Info:');
          console.log(`   Model: ${apiData.printer_info.model}`);
          console.log(`   Serial: ${apiData.printer_info.serial}`);
          console.log(`   Status: ${apiData.printer_info.status}`);
          console.log(`   Bed Temp: ${apiData.printer_info.temperature.bed}°C`);
          console.log(`   Nozzle Temp: ${apiData.printer_info.temperature.nozzle}°C`);
        }
      } else {
        console.log('❌ API Test: FAILED');
        console.log(`   Error: ${apiData.error}`);
      }

    } catch (apiError) {
      console.log('❌ API Test: FAILED');
      console.log(`   Error: ${apiError.message}`);
      console.log('   Make sure your Next.js development server is running (npm run dev)');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🔧 Configuration Help:');
  console.log('   Add these to your .env.local file:');
  console.log(`   DEFAULT_PRINTER_IP=${PRINTER_IP}`);
  console.log('   BAMBU_ACCESS_CODE=your-printer-access-code');
  console.log('');
  console.log('💡 Next Steps:');
  console.log('   1. Ensure printer is on the same network');
  console.log('   2. Get the access code from your Bambu Lab printer settings');
  console.log('   3. Test a real print job upload');
}

// Run the test
testPrinterConnection().catch(console.error);