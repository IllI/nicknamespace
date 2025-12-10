import Link from 'next/link';

// Mock product data - in a real app this would come from a database
const mockProducts = [
  {
    id: '1',
    name: 'Vintage Camera',
    description: 'A beautiful vintage camera perfect for photography enthusiasts.',
    price: '$299.99',
    image: '/placeholder-camera.jpg',
    category: 'Electronics'
  },
  {
    id: '2',
    name: 'Ceramic Vase',
    description: 'Handcrafted ceramic vase with intricate patterns.',
    price: '$89.99',
    image: '/placeholder-vase.jpg',
    category: 'Home Decor'
  },
  {
    id: '3',
    name: 'Wooden Sculpture',
    description: 'Artisan wooden sculpture carved from sustainable wood.',
    price: '$149.99',
    image: '/placeholder-sculpture.jpg',
    category: 'Art'
  },
  {
    id: '4',
    name: 'Metal Figurine',
    description: 'Detailed metal figurine with antique finish.',
    price: '$199.99',
    image: '/placeholder-figurine.jpg',
    category: 'Collectibles'
  },
  {
    id: '5',
    name: 'Glass Ornament',
    description: 'Delicate glass ornament with hand-painted details.',
    price: '$59.99',
    image: '/placeholder-ornament.jpg',
    category: 'Home Decor'
  },
  {
    id: '6',
    name: 'Leather Accessory',
    description: 'Premium leather accessory with custom engraving.',
    price: '$129.99',
    image: '/placeholder-leather.jpg',
    category: 'Accessories'
  }
];

export default function ProductsPage() {
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

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {mockProducts.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="bg-zinc-900 rounded-lg overflow-hidden hover:bg-zinc-800 transition-colors group"
            >
              {/* Product Image */}
              <div className="w-full h-64 bg-zinc-800 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-20 h-20 mx-auto mb-2 text-zinc-600 group-hover:text-zinc-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-zinc-600">{product.name}</p>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-6">
                <div className="mb-3">
                  <span className="inline-block px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">
                    {product.category}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-pink-400 transition-colors">
                  {product.name}
                </h3>

                <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
                  {product.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">
                    {product.price}
                  </span>

                  <div className="flex items-center text-sm text-zinc-400">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    3D Ready
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

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