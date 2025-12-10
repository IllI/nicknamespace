'use client';

import React, { useState } from 'react';
import { getStripe } from '@/utils/stripe/client';
import { useCart } from '@/contexts/CartContext';
import { useRouter } from 'next/navigation';

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
}

export default function ProductBuyButton({ product }: { product: Product }) {
    const [loading, setLoading] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);
    const { addItem } = useCart();
    const router = useRouter();

    const handleCheckout = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/checkout_sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    price: product.price,
                    name: product.name,
                    description: product.description,
                    productId: product.id,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Something went wrong');
            }

            const { sessionId } = await response.json();

            // Initialize Stripe
            const stripe = await getStripe();
            if (!stripe) {
                throw new Error('Stripe failed to initialize.');
            }

            const { error } = await stripe.redirectToCheckout({ sessionId });

            if (error) {
                console.error('Stripe error:', error);
                alert(error.message);
            }
        } catch (err: any) {
            console.error('Checkout error:', err);
            alert(err.message || 'Failed to start checkout');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = () => {
        addItem({
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
        });
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    return (
        <div className="space-y-3">
            <button
                onClick={handleAddToCart}
                disabled={loading}
                className="w-full bg-white hover:bg-zinc-100 text-black font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center border-2 border-zinc-800"
            >
                {addedToCart ? (
                    <>
                        <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Added to Cart!
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Add to Cart
                    </>
                )}
            </button>

            <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-pink-500/25 transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                    </>
                ) : (
                    'Buy Now - $' + product.price
                )}
            </button>

            <button
                onClick={async () => {
                    setLoading(true);
                    try {
                        const res = await fetch('/api/simulate_order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ product })
                        });
                        const data = await res.json();
                        alert(JSON.stringify(data, null, 2));
                    } catch (e: any) {
                        alert('Error: ' + e.message);
                    } finally {
                        setLoading(false);
                    }
                }}
                disabled={loading}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-3 px-8 rounded-xl transition-all duration-200 text-sm border border-zinc-700"
            >
                Test Fulfillment (No Stripe)
            </button>
        </div>
    );
}
