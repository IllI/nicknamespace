'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
    Save,
    Trash2,
    Plus,
    Image as ImageIcon,
    Video,
    Box,
    Settings,
    Search,
    Clock,
    Truck,
    X,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProductFormProps {
    initialData?: any;
    isEditing?: boolean;
}

export default function ProductForm({ initialData, isEditing = false }: ProductFormProps) {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        slug: initialData?.slug || '',
        description: initialData?.description || '',
        stripe_product_id: initialData?.stripe_product_id || '',
        hero_image: initialData?.hero_image || '',
        carousel_images: initialData?.carousel_images || [],
        video_url: initialData?.video_url || '',
        video_type: initialData?.video_type || 'youtube',
        estimated_print_time_minutes: initialData?.estimated_print_time_minutes || 60,
        estimated_delivery_days: initialData?.estimated_delivery_days || 3,
        custom_css: initialData?.custom_css || '',
        seo_title: initialData?.seo_title || '',
        seo_description: initialData?.seo_description || '',
        model_3d_url: initialData?.model_3d_url || '',
        is_active: initialData?.is_active !== undefined ? initialData.is_active : true,
        theme_config: initialData?.theme_config || {
            primaryColor: '#ec4899',
            accentColor: '#8b5cf6',
            fontFamily: 'sans',
            darkMode: true
        }
    });

    const [uploading, setUploading] = useState<string | null>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(field);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `products/${fileName}`;

            const { error: uploadError, data } = await supabase.storage
                .from('product-media')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-media')
                .getPublicUrl(filePath);

            if (field === 'carousel_images') {
                setFormData(prev => ({
                    ...prev,
                    carousel_images: [...prev.carousel_images, publicUrl]
                }));
            } else {
                setFormData(prev => ({ ...prev, [field]: publicUrl }));
            }
        } catch (error: any) {
            alert('Error uploading: ' + error.message);
        } finally {
            setUploading(null);
        }
    };

    const removeCarouselImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            carousel_images: prev.carousel_images.filter((_: any, i: number) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isEditing) {
                const { error } = await (supabase as any)
                    .from('innovative_products')
                    .update(formData)
                    .eq('id', initialData.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any)
                    .from('innovative_products')
                    .insert([formData]);
                if (error) throw error;
            }
            router.push('/admin/products');
            router.refresh();
        } catch (error: any) {
            alert('Error saving product: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-5xl space-y-8 pb-24">
            <div className="flex items-center justify-between sticky top-16 z-20 bg-zinc-950/80 backdrop-blur-md py-4 border-b border-zinc-800">
                <div className="flex items-center space-x-2 text-sm text-zinc-500">
                    <span className="hover:text-zinc-300 cursor-pointer" onClick={() => router.push('/admin/products')}>Products</span>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-white font-medium">{isEditing ? 'Edit Product' : 'New Product'}</span>
                </div>
                <div className="flex items-center space-x-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="bg-pink-600 hover:bg-pink-700 text-white min-w-[120px]"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                {isEditing ? 'Update Product' : 'Create Product'}
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-zinc-900 border border-zinc-800 p-1 mb-8">
                    <TabsTrigger value="general" className="data-[state=active]:bg-zinc-800">General</TabsTrigger>
                    <TabsTrigger value="media" className="data-[state=active]:bg-zinc-800">Media</TabsTrigger>
                    <TabsTrigger value="print" className="data-[state=active]:bg-zinc-800">Print & Logistics</TabsTrigger>
                    <TabsTrigger value="style" className="data-[state=active]:bg-zinc-800">Theme & Style</TabsTrigger>
                    <TabsTrigger value="seo" className="data-[state=active]:bg-zinc-800">SEO & Marketing</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Product Name</label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Cyberpunk Katana 3D Model"
                                required
                                className="bg-zinc-900 border-zinc-800 focus:border-pink-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">URL Slug</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-zinc-500 text-sm">/product/</span>
                                <Input
                                    value={formData.slug}
                                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                    placeholder="cyberpunk-katana"
                                    required
                                    className="bg-zinc-900 border-zinc-800 pl-24 focus:border-pink-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Stripe Product ID (Optional)</label>
                        <Input
                            value={formData.stripe_product_id}
                            onChange={e => setFormData({ ...formData, stripe_product_id: e.target.value })}
                            placeholder="prod_..."
                            className="bg-zinc-900 border-zinc-800"
                        />
                        <p className="text-xs text-zinc-500">Link this to your Stripe product for payment integration.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows={8}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
                            placeholder="Tell the story of this product..."
                        />
                    </div>
                </TabsContent>

                <TabsContent value="media" className="space-y-8 animate-in fade-in duration-300">
                    {/* Hero Image */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center">
                            <ImageIcon className="w-5 h-5 mr-2 text-pink-500" />
                            Hero Image
                        </h3>
                        <div className="relative group aspect-video bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center overflow-hidden">
                            <input id="hero-upload" type="file" className="hidden" onChange={e => handleUpload(e, 'hero_image')} />
                            {formData.hero_image ? (
                                <>
                                    <img src={formData.hero_image} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button type="button" variant="outline" size="sm" onClick={() => (document.getElementById('hero-upload') as HTMLInputElement).click()}>
                                            Replace Image
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center">
                                    <Plus className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                                    <p className="text-sm text-zinc-500">Click to upload hero image</p>
                                    <Button type="button" variant="link" className="text-pink-500" onClick={() => (document.getElementById('hero-upload') as HTMLInputElement).click()}>
                                        Browse file
                                    </Button>
                                </div>
                            )}
                            {uploading === 'hero_image' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}
                        </div>
                    </div>

                    {/* Carousel */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Image Carousel</h3>
                        <div className="grid grid-cols-4 gap-4">
                            {formData.carousel_images.map((img: string, i: number) => (
                                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-800">
                                    <img src={img} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => removeCarouselImage(i)}
                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <label className="aspect-square bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-zinc-600 transition-colors">
                                <Plus className="w-6 h-6 text-zinc-500" />
                                <span className="text-[10px] text-zinc-500 mt-1">Add Image</span>
                                <input type="file" className="hidden" onChange={e => handleUpload(e, 'carousel_images')} />
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Video */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center">
                                <Video className="w-5 h-5 mr-2 text-violet-500" />
                                Product Video
                            </h3>
                            <div className="space-y-4">
                                <select
                                    value={formData.video_type}
                                    onChange={e => setFormData({ ...formData, video_type: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 text-sm"
                                >
                                    <option value="youtube">YouTube Embed</option>
                                    <option value="vimeo">Vimeo Embed</option>
                                    <option value="upload">Direct Upload (MP4)</option>
                                </select>
                                <Input
                                    value={formData.video_url}
                                    onChange={e => setFormData({ ...formData, video_url: e.target.value })}
                                    placeholder={formData.video_type === 'upload' ? 'Upload or URL' : 'Video URL or ID'}
                                    className="bg-zinc-900 border-zinc-800"
                                />
                            </div>
                        </div>

                        {/* 3D Model */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center">
                                <Box className="w-5 h-5 mr-2 text-emerald-500" />
                                3D Model Preview
                            </h3>
                            <div className="relative group aspect-video bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center">
                                <input id="model-upload" type="file" className="hidden" onChange={e => handleUpload(e, 'model_3d_url')} />
                                {formData.model_3d_url ? (
                                    <div className="text-center">
                                        <Box className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                                        <p className="text-xs text-zinc-400 font-mono truncate max-w-[200px]">{formData.model_3d_url.split('/').pop()}</p>
                                        <Button type="button" variant="link" size="sm" onClick={() => (document.getElementById('model-upload') as HTMLInputElement).click()}>
                                            Change Model
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <Plus className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                                        <p className="text-xs text-zinc-500">Upload GLB/STL for 3D Viewer</p>
                                        <Button type="button" variant="link" size="sm" onClick={() => (document.getElementById('model-upload') as HTMLInputElement).click()}>
                                            Browse model
                                        </Button>
                                    </div>
                                )}
                                {uploading === 'model_3d_url' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="print" className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4 p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
                            <div className="flex items-center space-x-2 mb-2">
                                <Clock className="w-5 h-5 text-pink-500" />
                                <h3 className="font-semibold">Print Estimation</h3>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400">Estimated Print Time (minutes)</label>
                                <Input
                                    type="number"
                                    value={formData.estimated_print_time_minutes}
                                    onChange={e => setFormData({ ...formData, estimated_print_time_minutes: parseInt(e.target.value) })}
                                    className="bg-zinc-900 border-zinc-800"
                                />
                            </div>
                            <p className="text-xs text-zinc-500 italic">This helps calculate real-time production queues.</p>
                        </div>

                        <div className="space-y-4 p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
                            <div className="flex items-center space-x-2 mb-2">
                                <Truck className="w-5 h-5 text-blue-500" />
                                <h3 className="font-semibold">Delivery Time</h3>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400">Estimated Delivery Days (after production)</label>
                                <Input
                                    type="number"
                                    value={formData.estimated_delivery_days}
                                    onChange={e => setFormData({ ...formData, estimated_delivery_days: parseInt(e.target.value) })}
                                    className="bg-zinc-900 border-zinc-800"
                                />
                            </div>
                            <p className="text-xs text-zinc-500 italic">Will be added to print time for total dynamic delivery date.</p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="style" className="space-y-8 animate-in fade-in duration-300">
                    <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Primary Theme Color</label>
                            <div className="flex items-center space-x-4">
                                <input
                                    type="color"
                                    value={formData.theme_config.primaryColor}
                                    onChange={e => setFormData({ ...formData, theme_config: { ...formData.theme_config, primaryColor: e.target.value } })}
                                    className="w-12 h-12 rounded bg-zinc-900 border-zinc-800"
                                />
                                <Input
                                    value={formData.theme_config.primaryColor}
                                    onChange={e => setFormData({ ...formData, theme_config: { ...formData.theme_config, primaryColor: e.target.value } })}
                                    className="bg-zinc-900 border-zinc-800 flex-1"
                                />
                            </div>
                        </div>
                        {/* Add more style options as needed */}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-zinc-400">Custom CSS Overrides</label>
                            <span className="text-[10px] text-pink-500 font-mono">Advanced Mode</span>
                        </div>
                        <textarea
                            value={formData.custom_css}
                            onChange={e => setFormData({ ...formData, custom_css: e.target.value })}
                            rows={10}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-4 text-xs font-mono text-pink-300 focus:outline-none focus:ring-1 focus:ring-pink-500"
                            placeholder=".product-page { background: linear-gradient(...); }"
                        />
                    </div>
                </TabsContent>

                <TabsContent value="seo" className="space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-4 p-6 bg-zinc-900/30 rounded-xl border border-zinc-800">
                        <div className="flex items-center space-x-2 mb-4">
                            <Search className="w-5 h-5 text-yellow-500" />
                            <h3 className="font-semibold font-sans">Search Engine Optimization</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400 font-sans">Meta Title</label>
                                <Input
                                    value={formData.seo_title}
                                    onChange={e => setFormData({ ...formData, seo_title: e.target.value })}
                                    placeholder="The Ultimate Cyberpunk Katana - Buy Now"
                                    className="bg-zinc-900 border-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-400 font-sans">Meta Description</label>
                                <textarea
                                    value={formData.seo_description}
                                    onChange={e => setFormData({ ...formData, seo_description: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 text-sm"
                                    rows={3}
                                    placeholder="A one-of-a-kind 3D printed collectible that..."
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-zinc-800">
                            <div className="flex items-center space-x-2 mb-4">
                                <Plus className="w-5 h-5 text-sky-500" />
                                <h3 className="font-semibold font-sans">Social Media Integration (Roadmap)</h3>
                            </div>
                            <p className="text-sm text-zinc-500">
                                Standalone product pages automatically include OpenGraph and Twitter cards to make them appear as separate sites when shared.
                            </p>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </form>
    );
}
