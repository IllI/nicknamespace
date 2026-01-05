'use client';

import { useCart } from '@/contexts/CartContext';
import Link from 'next/link';
import { useState } from 'react';
import { getStripe } from '@/utils/stripe/client';

export default function CartPage() {
    const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCart();
    const [loading, setLoading] = useState(false);

    const handleCheckout = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/checkout_sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        name: item.name,
                        description: item.description,
                        price: item.price,
                        quantity: item.quantity,
                        productId: item.id
                    }))
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Something went wrong');
            }

            const { sessionId } = await response.json();
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

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center px-4">
                <div className="text-center">
                    <svg className="w-24 h-24 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h2 className="text-3xl font-bold text-white mb-4">Your cart is empty</h2>
                    <p className="text-zinc-400 mb-8">Add some products to get started</p>
                    <Link
                        href="/products"
                        className="inline-block px-8 py-3 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-semibold rounded-lg transition-all"
                    >
                        Browse Products
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black py-12 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-white">Shopping Cart</h1>
                    <button
                        onClick={clearCart}
                        className="text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                        Clear Cart
                    </button>
                </div>

                <div className="space-y-4 mb-8">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="bg-zinc-900 rounded-lg p-6 flex items-center gap-6"
                        >
                            <div className="w-24 h-24 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-12 h-12 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>

                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white mb-1">{item.name}</h3>
                                <p className="text-sm text-zinc-400 mb-2">{item.description}</p>
                                <p className="text-white font-semibold">${item.price.toFixed(2)}</p>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-2">
                                    <button
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                        className="w-8 h-8 flex items-center justify-center text-white hover:bg-zinc-700 rounded transition-colors"
                                    >
                                        -
                                    </button>
                                    <span className="w-8 text-center text-white font-semibold">{item.quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        className="w-8 h-8 flex items-center justify-center text-white hover:bg-zinc-700 rounded transition-colors"
                                    >
                                        +
                                    </button>
                                </div>

                                <button
                                    onClick={() => removeItem(item.id)}
                                    className="text-red-400 hover:text-red-300 transition-colors p-2"
                                    aria-label="Remove item"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-zinc-900 rounded-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-xl font-semibold text-white">Total:</span>
                        <span className="text-3xl font-bold text-white">${totalPrice.toFixed(2)}</span>
                    </div>

                    <button
                        onClick={handleCheckout}
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                    >
                        {loading ? 'Processing...' : 'Proceed to Checkout'}
                    </button>

                    <Link
                        href="/products"
                        className="block text-center mt-4 text-zinc-400 hover:text-white transition-colors"
                    >
                        Continue Shopping
                    </Link>
                </div>
            </div>
        </div>
    );
}
