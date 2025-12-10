import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import ProductConversionIntegration from '@/components/ui/3d-conversion/ProductConversionIntegration';
import Link from 'next/link';
import ProductBuyButton from '@/components/ProductBuyButton';

interface PageProps {
  params: {
    id: string;
  };
}

// Mock product data - in a real app this would come from a database
const mockProducts = {
  '1': {
    id: '1',
    name: 'Vintage Camera',
    description: 'A beautiful vintage camera perfect for photography enthusiasts.',
    price: '$299.99',
    image: '/placeholder-camera.jpg',
    category: 'Electronics'
  },
  '2': {
    id: '2',
    name: 'Ceramic Vase',
    description: 'Handcrafted ceramic vase with intricate patterns.',
    price: '$89.99',
    image: '/placeholder-vase.jpg',
    category: 'Home Decor'
  },
  '3': {
    id: '3',
    name: 'Wooden Sculpture',
    description: 'Artisan wooden sculpture carved from sustainable wood.',
    price: '$149.99',
    image: '/placeholder-sculpture.jpg',
    category: 'Art'
  }
};

export default async function ProductPage({ params }: PageProps) {
  const supabase = createClient();
  const user = await getUser(supabase);

  // Get product data (mock for demonstration)
  const product = mockProducts[params.id as keyof typeof mockProducts];

  if (!product) {
    return notFound();
  }

  return (
    <section className="min-h-screen bg-black">
      <div className="max-w-6xl px-4 py-8 mx-auto sm:px-6 sm:pt-24 lg:px-8">
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
                <Link href="/products" className="ml-1 text-sm font-medium text-zinc-400 hover:text-white md:ml-2">Products</Link>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-3 h-3 text-zinc-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4" />
                </svg>
                <span className="ml-1 text-sm font-medium text-white md:ml-2">{product.name}</span>
              </div>
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="bg-zinc-900 rounded-lg p-8 flex items-center justify-center">
            <div className="w-full h-96 bg-zinc-800 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <svg className="w-24 h-24 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-zinc-500">Product Image</p>
                <p className="text-xs text-zinc-600 mt-1">{product.name}</p>
              </div>
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-8">
            {/* Product Info */}
            <div>
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm">
                  {product.category}
                </span>
              </div>

              <h1 className="text-4xl font-extrabold text-white mb-4">
                {product.name}
              </h1>

              <p className="text-xl text-zinc-300 mb-6">
                {product.description}
              </p>

              <div className="text-3xl font-bold text-white mb-8">
                {product.price}
              </div>
            </div>

            {/* Purchase Actions */}
            <div className="space-y-4">
              <ProductBuyButton
                product={{
                  ...product,
                  price: parseFloat(product.price.replace('$', ''))
                }}
              />

              <button className="w-full px-8 py-4 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors font-semibold">
                Add to Wishlist
              </button>
            </div>

            {/* Product Features */}
            <div className="pt-8 border-t border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-4">Features</h3>
              <ul className="space-y-2 text-zinc-300">
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  High-quality materials
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Handcrafted with care
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  30-day return policy
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 3D Conversion Integration */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">
            Create Your Own 3D Version
          </h2>
          <ProductConversionIntegration
            user={user}
            productId={product.id}
            productName={product.name}
          />
        </div>

        {/* Related Products Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-8">Related Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.values(mockProducts)
              .filter(p => p.id !== product.id)
              .slice(0, 3)
              .map((relatedProduct) => (
                <Link
                  key={relatedProduct.id}
                  href={`/products/${relatedProduct.id}`}
                  className="bg-zinc-900 rounded-lg p-6 hover:bg-zinc-800 transition-colors"
                >
                  <div className="w-full h-48 bg-zinc-800 rounded-lg mb-4 flex items-center justify-center">
                    <svg className="w-16 h-16 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{relatedProduct.name}</h3>
                  <p className="text-zinc-400 text-sm mb-3">{relatedProduct.description}</p>
                  <p className="text-white font-semibold">{relatedProduct.price}</p>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}