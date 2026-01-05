import ProductForm from '@/components/admin/ProductForm';

export default function NewProductPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Create Innovative Product</h1>
                <p className="text-zinc-500 mt-1">Design a standalone product experience.</p>
            </div>

            <ProductForm isEditing={false} />
        </div>
    );
}
