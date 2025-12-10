import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import PrintingDashboardClient from '@/components/ui/3d-printing/PrintingDashboardClient';
import AuthRecovery from '@/components/ui/AuthRecovery';

export default async function PrintingDashboard() {
  try {
    const supabase = createClient();
    const user = await getUser(supabase);

    if (!user) {
      return redirect('/signin');
    }

    return <PrintingDashboardClient userId={user.id} />;
  } catch (error) {
    console.error('Auth error in 3D printing page:', error);
    // If there's an auth error, show recovery component
    return <AuthRecovery />;
  }
}