import { NextResponse } from 'next/server';
import { sendOrderEmail, createCalendarEvent } from '@/utils/fulfillment';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { product } = body;

        // Simulate order details
        const orderDetails = {
            productName: product.name,
            amount: product.price * 100, // Convert to cents
            customerEmail: 'test-user@example.com', // Mock email
            orderId: `test_order_${Date.now()}`,
        };

        console.log('Simulating fulfillment for:', orderDetails);

        // 1. Send Email
        const emailSent = await sendOrderEmail('nicholasberg7@gmail.com', orderDetails);

        // 2. Create Calendar Event
        const eventCreated = await createCalendarEvent(orderDetails);

        // 3. Submit to Print Service (if product has a 3D model)
        let printJobSubmitted = false;
        let printJobId = null;

        // Create an admin/service client to bypass RLS for this system task
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Supabase environment variables are MISSING in the API route!');
        }

        const supabaseStore = createSupabaseAdminClient(supabaseUrl!, supabaseServiceKey!);

        // Get the product from database - checking both direct ID and Stripe Product ID
        console.log('🔍 Executing database lookup for product ID:', product.id);

        const idQuery = await supabaseStore
            .from('innovative_products')
            .select('*')
            .eq('id', product.id)
            .single();

        let dbProduct = idQuery.data;

        if (idQuery.error) {
            console.log('ℹ️ UUID lookup status:', idQuery.error.code, '-', idQuery.error.message);
        }

        // If not found by ID, try looking up by Stripe Product ID
        if (!dbProduct && product.id && product.id.length > 5) {
            console.log('ℹ️ Trying stripe_product_id lookup for:', product.id);
            const stripeQuery = await supabaseStore
                .from('innovative_products')
                .select('*')
                .eq('stripe_product_id', product.id)
                .single();
            dbProduct = stripeQuery.data;

            if (stripeQuery.error && !idQuery.data) {
                console.log('ℹ️ Stripe lookup status:', stripeQuery.error.code, '-', stripeQuery.error.message);
            }
        }

        const productData = dbProduct as any;

        if (!dbProduct) {
            console.log('❌ Product NOT found in database after both lookup attempts for:', product.id);
        } else {
            console.log('✅ Found product in database:', productData.slug, '(DB ID:', productData.id, ')');
        }

        // Use model_storage_path if available, otherwise extract path from model_3d_url
        let storagePath = productData?.model_storage_path;

        if (!storagePath && productData?.model_3d_url) {
            console.log('🔍 No storage_path found, attempting to derive from model_3d_url:', productData.model_3d_url);
            // Extract "product-media/products/..." from the full Supabase URL
            // Format: https://[project].supabase.co/storage/v1/object/public/[path]
            const urlParts = productData.model_3d_url.split('/public/');
            if (urlParts.length > 1) {
                storagePath = urlParts[1];
                console.log('🔗 Derived storage path from URL:', storagePath);
            }
        }

        if (storagePath) {
            try {
                const printServiceUrl = process.env.PRINT_SERVICE_URL || 'http://localhost:3001';
                console.log('📤 Submitting print job to:', printServiceUrl);

                const printResponse = await fetch(`${printServiceUrl}/api/print-job`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        job_id: orderDetails.orderId,
                        storage_path: storagePath,
                        product_name: product.name,
                        product_slug: productData.slug,
                    }),
                });

                if (printResponse.ok) {
                    const printData = await printResponse.json();
                    printJobSubmitted = true;
                    printJobId = printData.job_id;
                    console.log('✅ Print job submitted:', printJobId);
                } else {
                    console.error('❌ Print service error:', await printResponse.text());
                }
            } catch (printError) {
                console.error('❌ Failed to submit print job:', printError);
            }
        } else {
            console.log('ℹ️ No 3D model found for this product, skipping print job');
        }

        return NextResponse.json({
            success: true,
            message: 'Fulfillment simulation complete',
            results: {
                emailSent,
                eventCreated,
                printJobSubmitted,
                printJobId
            }
        });
    } catch (error: any) {
        console.error('Simulation error:', error);
        return NextResponse.json(
            { message: error.message || 'Simulation failed' },
            { status: 500 }
        );
    }
}
