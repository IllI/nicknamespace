import { PropsWithChildren } from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen bg-zinc-950 text-white font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
                <div className="p-6">
                    <Link href="/admin" className="text-xl font-bold tracking-tighter text-white hover:text-pink-500 transition-colors">
                        ADMIN PANEL
                    </Link>
                </div>
                <nav className="px-4 py-4 space-y-1">
                    <Link href="/admin" className="block px-4 py-2 text-sm font-medium rounded-md hover:bg-zinc-800 transition-colors">
                        Dashboard
                    </Link>
                    <Link href="/admin/products" className="block px-4 py-2 text-sm font-medium rounded-md bg-zinc-800 text-pink-400">
                        Innovative Products
                    </Link>
                    <Link href="/admin/conversions" className="block px-4 py-2 text-sm font-medium rounded-md hover:bg-zinc-800 transition-colors">
                        3D Conversions
                    </Link>
                    <Link href="/admin/printing" className="block px-4 py-2 text-sm font-medium rounded-md hover:bg-zinc-800 transition-colors">
                        Print Jobs
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">
                        Innovative Products Management
                    </h2>
                    <div className="flex items-center space-x-4">
                        <Link href="/" className="text-xs text-zinc-500 hover:text-white transition-colors">
                            View Site
                        </Link>
                        <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-xs font-bold">
                            A
                        </div>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
