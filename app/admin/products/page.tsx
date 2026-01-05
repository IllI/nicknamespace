import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Plus, ExternalLink, Edit2, Trash2, Package } from 'lucide-react';

export default async function AdminProductsPage() {
    const supabase = createClient();

    const { data: products, error } = await supabase
        .from('innovative_products')
        .select('*')
        .order('created_at', { ascending: false });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Innovative Products</h1>
                    <p className="text-zinc-500 mt-1">Manage standalone product pages and 3D print ready models.</p>
                </div>
                <Link
                    href="/admin/products/new"
                    className="inline-flex items-center px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-pink-500/20"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Product
                </Link>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    Error loading products: {error.message}
                </div>
            )}

            {!products || products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
                    <Package className="w-12 h-12 text-zinc-700 mb-4" />
                    <h3 className="text-lg font-medium text-zinc-400">No products found</h3>
                    <p className="text-sm text-zinc-500 mt-2">Get started by creating your first innovative product.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product: any) => (
                        <div
                            key={product.id}
                            className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-pink-500/50 transition-all duration-300 shadow-xl"
                        >
                            <div className="aspect-video relative overflow-hidden bg-zinc-800">
                                {product.hero_image ? (
                                    <img
                                        src={product.hero_image}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                        <Package className="w-12 h-12" />
                                    </div>
                                )}
                                <div className="absolute top-4 left-4">
                                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${product.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                        {product.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-5 space-y-4">
                                <div>
                                    <h3 className="text-lg font-bold group-hover:text-pink-400 transition-colors">{product.name}</h3>
                                    <p className="text-sm text-zinc-500 line-clamp-1">/{product.slug}</p>
                                </div>

                                <div className="flex items-center space-x-3 pt-2">
                                    <Link
                                        href={`/admin/products/${product.id}`}
                                        className="flex-1 flex items-center justify-center px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-semibold transition-colors"
                                    >
                                        <Edit2 className="w-3 h-3 mr-2" />
                                        Edit
                                    </Link>
                                    <Link
                                        href={`/product/${product.slug}`}
                                        target="_blank"
                                        className="flex items-center justify-center w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-white transition-all"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
