import React from 'react';
import ProductBuyButton from '@/components/ProductBuyButton';
import Link from 'next/link';

export default function ProductTemplatePage() {
  const product = {
    id: '3d-model-001',
    name: 'Futuristic 3D City Model',
    description: 'A highly detailed, 3D-printable model of a futuristic city block. Perfect for dioramas, sci-fi settings, and architectural visualization. Optimized for FDM and SLA printers.',
    price: 49.99,
    features: [
      'High-resolution STL files',
      'Support-free printing options',
      'Modular design',
      'Includes 5 unique building types'
    ]
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-pink-500 selection:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24">
        <nav className="flex mb-8" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link href="/" className="inline-flex items-center text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                Home
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <span className="mx-2 text-zinc-600">/</span>
                <span className="text-sm font-medium text-white">Product Template</span>
              </div>
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
          {/* Product Visuals */}
          <div className="space-y-6">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800 shadow-2xl group">
              <div className="absolute inset-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                <div className="w-64 h-64 bg-gradient-to-tr from-pink-500 to-violet-600 rounded-full blur-[100px] opacity-20 animate-pulse"></div>
                <svg className="w-32 h-32 text-zinc-700 drop-shadow-lg relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-xl p-4">
                  <p className="text-sm text-zinc-300 font-medium">3D Preview Available</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-square rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer flex items-center justify-center">
                  <span className="text-zinc-600 text-xs">View {i}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex flex-col h-full justify-center">
            <div className="mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
                New Release
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
              {product.name}
            </h1>

            <div className="flex items-baseline mb-8">
              <span className="text-3xl font-bold text-white">${product.price}</span>
              <span className="ml-2 text-lg text-zinc-500">USD</span>
            </div>

            <p className="text-lg text-zinc-400 leading-relaxed mb-10">
              {product.description}
            </p>

            <div className="space-y-6 mb-10">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Key Features</h3>
              <ul className="space-y-3">
                {product.features.map((feature, index) => (
                  <li key={index} className="flex items-start text-zinc-300">
                    <svg className="w-5 h-5 mr-3 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8 border-t border-zinc-800">
              <ProductBuyButton product={product} />
              <p className="mt-4 text-center text-sm text-zinc-500">
                Secure checkout powered by Stripe. Instant digital delivery.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
