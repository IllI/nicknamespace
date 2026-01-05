import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductBuyButton from '@/components/ProductBuyButton';
import { Box, Clock, Truck, ShieldCheck, Star } from 'lucide-react';

interface StandaloneProductPageProps {
    params: {
        slug: string;
    };
}

export async function generateMetadata(
    { params }: StandaloneProductPageProps
): Promise<Metadata> {
    const supabase = createClient();
    const { data: product } = await supabase
        .from('innovative_products')
        .select('*')
        .eq('slug', params.slug)
        .single();

    if (!product) return {};
    const p = product as any;

    return {
        title: p.seo_title || p.name,
        description: p.seo_description || p.description,
        openGraph: {
            title: p.seo_title || p.name,
            description: p.seo_description || p.description,
            images: [p.hero_image].filter(Boolean),
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: p.seo_title || p.name,
            description: p.seo_description || p.description,
            images: [p.hero_image].filter(Boolean),
        },
        // This is the key for "standalone" feel
        alternates: {
            canonical: `/product/${p.slug}`,
        }
    };
}

export default async function StandaloneProductPage({ params }: StandaloneProductPageProps) {
    const supabase = createClient();

    const { data: product } = await supabase
        .from('innovative_products')
        .select('*')
        .eq('slug', params.slug)
        .single();

    if (!product) {
        return notFound();
    }

    const p = product as any;
    const theme = p.theme_config || {};
    const primaryColor = theme.primaryColor || '#ec4899';

    return (
        <div className="standalone-page min-h-screen bg-black text-white selection:bg-pink-500">
            {/* CSS Injection for "Standalone" feel - hiding main site UI */}
            <style dangerouslySetInnerHTML={{
                __html: `
        #navbar, #footer, .main-navbar, .main-footer, header, footer { display: none !important; }
        #skip { min-height: 100vh !important; margin-top: 0 !important; }
        ${p.custom_css || ''}
      `}} />

            {/* Standalone Minimal Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="text-xl font-black tracking-tighter" style={{ color: primaryColor }}>
                        {p.name.toUpperCase()}
                    </div>
                    <a href="#buy" className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95 bg-white text-black">
                        ORDER NOW
                    </a>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center pt-24 pb-12 overflow-hidden">
                {/* Animated Background Details */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 blur-[120px] opacity-20 rounded-full animate-pulse" style={{ background: primaryColor }}></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 blur-[120px] opacity-20 rounded-full animate-pulse delay-1000" style={{ background: theme.accentColor || '#8b5cf6' }}></div>
                </div>

                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
                    <div className="space-y-8 animate-in slide-in-from-left duration-1000">
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase bg-white/10 border border-white/10 backdrop-blur-md">
                            <Star className="w-3 h-3 mr-2" style={{ fill: primaryColor, color: primaryColor }} />
                            Exclusive Release
                        </div>

                        <h1 className="text-6xl lg:text-8xl font-black tracking-tighter leading-none">
                            {p.name}
                        </h1>

                        <p className="text-xl text-zinc-400 max-w-xl leading-relaxed">
                            {p.description}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <a href="#buy" className="px-8 py-4 rounded-xl text-lg font-bold transition-all hover:scale-105 shadow-2xl shadow-pink-500/20 text-center" style={{ backgroundColor: primaryColor }}>
                                Secure Yours Now
                            </a>
                            {p.model_3d_url && (
                                <a href="#preview" className="px-8 py-4 rounded-xl text-lg font-bold border border-white/10 hover:bg-white/5 transition-all text-center">
                                    View in 3D
                                </a>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-8 pt-8">
                            <div className="flex items-center space-x-3">
                                <Box className="w-5 h-5 text-zinc-500" />
                                <div>
                                    <div className="text-sm font-bold">Print on Demand</div>
                                    <div className="text-xs text-zinc-500">Customized for you</div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <ShieldCheck className="w-5 h-5 text-zinc-500" />
                                <div>
                                    <div className="text-sm font-bold">Secure Delivery</div>
                                    <div className="text-xs text-zinc-500">Guaranteed quality</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in duration-1000">
                        <div className="aspect-square relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                            <img
                                src={p.hero_image}
                                alt={p.name}
                                className="w-full h-full object-cover transition-transform duration-10000 hover:scale-110"
                            />
                        </div>
                        {/* Floating Detail */}
                        <div className="absolute -bottom-6 -left-6 p-6 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[200px]">
                            <div className="text-xs text-zinc-500 uppercase font-black mb-1">Time to Print</div>
                            <div className="text-2xl font-black" style={{ color: primaryColor }}>{p.estimated_print_time_minutes}m</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Logistics Details */}
            <section className="py-24 border-t border-white/5 bg-zinc-950">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5 space-y-4">
                        <Clock className="w-10 h-10" style={{ color: primaryColor }} />
                        <h3 className="text-xl font-bold">Production Time</h3>
                        <p className="text-zinc-400">Your product is printed to order. Current estimated production time is approximately {p.estimated_print_time_minutes} minutes from start to finish.</p>
                    </div>
                    <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5 space-y-4">
                        <Truck className="w-10 h-10" style={{ color: primaryColor }} />
                        <h3 className="text-xl font-bold">Global Shipping</h3>
                        <p className="text-zinc-400">Once printed, your item is carefully packed and shipped. Estimated delivery in {p.estimated_delivery_days} business days.</p>
                    </div>
                    <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5 space-y-4">
                        <Box className="w-10 h-10" style={{ color: primaryColor }} />
                        <h3 className="text-xl font-bold">Build Quality</h3>
                        <p className="text-zinc-400">We use high-grade materials optimized for this specific model, ensuring durability and high-fidelity detail.</p>
                    </div>
                </div>
            </section>

            {/* Video Content */}
            {p.video_url && (
                <section className="py-24 bg-black">
                    <div className="max-w-5xl mx-auto px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-4xl font-black mb-4 uppercase">See it in action</h2>
                        </div>
                        <div className="aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-3xl bg-zinc-900">
                            {p.video_type === 'youtube' ? (
                                <iframe
                                    className="w-full h-full"
                                    src={`https://www.youtube.com/embed/${p.video_url.split('v=')[1] || p.video_url.split('/').pop()}`}
                                    frameBorder="0"
                                    allowFullScreen
                                />
                            ) : (
                                <video src={p.video_url} controls className="w-full h-full object-cover" />
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* Purchase Section */}
            <section id="buy" className="py-32 bg-zinc-950 relative overflow-hidden">
                <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-5xl lg:text-7xl font-black tracking-tighter mb-8 uppercase">Own the {p.name}</h2>
                    <div className="bg-black border border-white/10 p-12 rounded-[40px] shadow-3xl space-y-10">
                        <div className="space-y-2">
                            <div className="text-zinc-500 uppercase font-black tracking-widest text-sm">Investment</div>
                            <div className="text-6xl font-black">$49.99</div> {/** Mock price - should come from Stripe */}
                        </div>

                        <div className="pt-4">
                            <ProductBuyButton
                                product={{
                                    id: p.stripe_product_id || p.id,
                                    name: p.name,
                                    description: p.description,
                                    price: 49.99, // Fallback
                                    image: p.hero_image
                                }}
                            />
                        </div>

                        <p className="text-zinc-500 text-sm italic">
                            Production starts immediately after successful checkout. You will receive a tracking number as soon as the print is complete.
                        </p>
                    </div>
                </div>
            </section>

            {/* Minimal Footer */}
            <footer className="py-12 border-t border-white/5 text-center text-zinc-600 text-xs uppercase tracking-widest font-bold">
                &copy; {new Date().getFullYear()} {p.name} Standalone Division
            </footer>
        </div>
    );
}
