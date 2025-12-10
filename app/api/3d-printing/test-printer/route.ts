/**
 * Test Printer Connection API
 * Tests connectivity to the Bambu Lab printer
 */

import { NextRequest, NextResponse } from 'next/server';
import { testPrinterConnection, createPrinterClient } from '@/lib/services/bambu-printer-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { printer_ip, access_code } = body;

    if (!printer_ip) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: printer_ip',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    console.log(`Testing connection to printer at ${printer_ip}`);

    // Test basic connectivity
    const connected = await testPrinterConnection(printer_ip, access_code);

    if (!connected) {
      return NextResponse.json({
        success: false,
        printer_ip,
        connected: false,
        error: 'Cannot connect to printer. Check IP address and network connectivity.',
        timestamp: new Date().toISOString()
      });
    }

    // Get detailed printer info if connected
    try {
      const client = createPrinterClient(printer_ip, 'test', access_code);
      const printerInfo = await client.getPrinterInfo();

      return NextResponse.json({
        success: true,
        printer_ip,
        connected: true,
        printer_info: printerInfo,
        message: 'Successfully connected to printer',
        timestamp: new Date().toISOString()
      });

    } catch (infoError) {
      // Connection works but couldn't get detailed info
      return NextResponse.json({
        success: true,
        printer_ip,
        connected: true,
        printer_info: null,
        message: 'Connected to printer but could not retrieve detailed information',
        warning: infoError instanceof Error ? infoError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Printer test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Get default printer info from environment/config
 */
export async function GET() {
  try {
    const defaultPrinterIp = process.env.DEFAULT_PRINTER_IP || '192.168.1.129';
    const defaultPrinterSerial = process.env.DEFAULT_PRINTER_SERIAL || '01P09A3A1800831';

    return NextResponse.json({
      success: true,
      default_printer: {
        ip: defaultPrinterIp,
        serial: defaultPrinterSerial,
      },
      message: 'Use POST /api/3d-printing/test-printer to test connectivity',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get printer info error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}