import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';

export default async function ProductsPage() {
  const supabase = createClient();

  // Fetch real products from database
  const { data: products, error } = await supabase
    .from('innovative_products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return (
    <section className="min-h-screen bg-black">
      <div className="max-w-6xl px-4 py-8 mx-auto sm:px-6 sm:pt-24 lg:px-8">
        {/* Header */}
        <div className="sm:align-center sm:flex sm:flex-col mb-12">
          <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
            Ready to Print Models
          </h1>
          <p className="max-w-2xl m-auto mt-5 text-xl text-zinc-200 sm:text-center sm:text-2xl">
            Click to print models ship to order
          </p>
        </div>

        {/* Breadcrumb Navigation */}
        <nav className="flex mb-8" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link href="/" className="inline-flex items-center text-sm font-medium text-zinc-400 hover:text-white">
                <svg className="w-3 h-3 mr-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                  <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L9 3.414V19a1 1 0 0 0 2 0V3.414l7.293 7.293a1 1 0 0 0 1.414-1.414Z" />
                </svg>
                Home
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-3 h-3 text-zinc-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4" />
                </svg>
                <span className="ml-1 text-sm font-medium text-white md:ml-2">Products</span>
              </div>
            </li>
          </ol>
        </nav>

        {/* 3D Conversion CTA */}
        <div className="mb-12 bg-gradient-to-r from-pink-500/10 to-violet-500/10 border border-pink-500/20 rounded-lg p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              Turn Any Product Into a 3D Model
            </h2>
            <p className="text-zinc-300 mb-6">
              Upload a photo of any product and our AI will convert it into a 3D model ready for printing.
              Perfect for creating custom versions or replacement parts.
            </p>
            <Link
              href="/3d-conversion"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Start 3D Conversion
            </Link>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 mb-8 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            Error loading products: {error.message}
          </div>
        )}

        {/* Empty State */}
        {!error && (!products || products.length === 0) && (
          <div className="flex flex-col items-center justify-center py-24 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800 mb-12">
            <svg className="w-20 h-20 mx-auto mb-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-lg font-medium text-zinc-400">No products available yet</h3>
            <p className="text-sm text-zinc-500 mt-2">Check back soon for new 3D print-ready models!</p>
          </div>
        )}

        {/* Products Grid */}
        {!error && products && products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product: any) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className="bg-zinc-900 rounded-lg overflow-hidden hover:bg-zinc-800 transition-colors group"
              >
                {/* Product Image */}
                <div className="w-full h-64 bg-zinc-800 flex items-center justify-center overflow-hidden">
                  {product.hero_image ? (
                    <img
                      src={product.hero_image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-center">
                      <svg className="w-20 h-20 mx-auto mb-2 text-zinc-600 group-hover:text-zinc-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs text-zinc-600">{product.name}</p>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-pink-400 transition-colors">
                    {product.name}
                  </h3>

                  {product.tagline && (
                    <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
                      {product.tagline}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center text-sm text-pink-400">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      3D Ready
                    </div>
                    <span className="text-sm text-zinc-500 group-hover:text-pink-400 transition-colors">
                      View Details →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Don't See What You're Looking For?
          </h2>
          <p className="text-zinc-400 mb-8 max-w-2xl mx-auto">
            Upload any image and convert it to a 3D model. Our AI can handle photos of products,
            artwork, sculptures, and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/3d-conversion"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Upload & Convert
            </Link>

            <Link
              href="/3d-conversion/history"
              className="inline-flex items-center px-8 py-4 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              View My Conversions
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}