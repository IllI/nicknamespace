import { stripe } from '@/utils/stripe/config';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { price, name, description, productId, items } = body;

        const origin = req.headers.get('origin') || 'http://localhost:3000';

        // Handle cart checkout (multiple items)
        if (items && Array.isArray(items)) {
            const lineItems = items.map(item => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        description: item.description,
                        metadata: {
                            productId: item.productId
                        }
                    },
                    unit_amount: Math.round(item.price * 100),
                },
                quantity: item.quantity,
            }));

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: 'payment',
                success_url: `${origin}/cart?success=true`,
                cancel_url: `${origin}/cart?canceled=true`,
                metadata: {
                    type: 'cart_order',
                    itemCount: items.length.toString()
                }
            });

            return NextResponse.json({ sessionId: session.id });
        }

        // Handle single product checkout (Buy Now)
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: name,
                            description: description,
                            metadata: {
                                productId: productId
                            }
                        },
                        unit_amount: Math.round(price * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/products/${productId}?success=true`,
            cancel_url: `${origin}/products/${productId}?canceled=true`,
            metadata: {
                productId: productId,
                type: 'single_product_order'
            }
        });

        return NextResponse.json({ sessionId: session.id });
    } catch (err: any) {
        console.error('Error creating checkout session:', err);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}
