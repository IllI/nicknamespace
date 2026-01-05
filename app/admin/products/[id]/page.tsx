import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';

interface EditProductPageProps {
    params: {
        id: string;
    };
}

export default async function EditProductPage({ params }: EditProductPageProps) {
    const supabase = createClient();

    const { data: fetchedProduct } = await supabase
        .from('innovative_products')
        .select('*')
        .eq('id', params.id)
        .single();

    if (!fetchedProduct) {
        return notFound();
    }

    const typedProduct = fetchedProduct as any;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
                <p className="text-zinc-500 mt-1">Refine the standalone experience for {typedProduct.name}.</p>
            </div>

            <ProductForm initialData={typedProduct} isEditing={true} />
        </div>
    );
}
