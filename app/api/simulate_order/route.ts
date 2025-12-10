import { NextResponse } from 'next/server';
import { sendOrderEmail, createCalendarEvent } from '@/utils/fulfillment';

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

        return NextResponse.json({
            success: true,
            message: 'Fulfillment simulation complete',
            results: {
                emailSent,
                eventCreated
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
