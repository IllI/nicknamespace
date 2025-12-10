// API route for user usage tracking and analytics

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { UsageTrackingService } from '@/lib/services/usage-tracking-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'stats';

    switch (type) {
      case 'stats': {
        const stats = await UsageTrackingService.getUserUsageStats(user.id);
        return NextResponse.json({ stats });
      }

      case 'history': {
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const history = await UsageTrackingService.getUserConversionHistory(user.id, limit, offset);
        return NextResponse.json({ history });
      }

      case 'costs': {
        const costs = await UsageTrackingService.getUserCostBreakdown(user.id);
        return NextResponse.json({ costs });
      }

      case 'analytics': {
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');
        
        if (!startDateParam || !endDateParam) {
          return NextResponse.json(
            { error: 'startDate and endDate parameters are required for analytics' },
            { status: 400 }
          );
        }

        const startDate = new Date(startDateParam);
        const endDate = new Date(endDateParam);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return NextResponse.json(
            { error: 'Invalid date format' },
            { status: 400 }
          );
        }

        const analytics = await UsageTrackingService.getUsageAnalytics(user.id, startDate, endDate);
        return NextResponse.json({ analytics });
      }

      case 'upgrade-check': {
        const upgradeCheck = await UsageTrackingService.shouldPromptUpgrade(user.id);
        return NextResponse.json({ upgradeCheck });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use: stats, history, costs, analytics, or upgrade-check' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'check-limits': {
        const result = await UsageTrackingService.canUserConvert(user.id);
        return NextResponse.json(result);
      }

      case 'record-conversion': {
        const { conversionId, apiCost } = params;
        if (!conversionId) {
          return NextResponse.json(
            { error: 'conversionId is required' },
            { status: 400 }
          );
        }

        await UsageTrackingService.recordConversionAttempt(user.id, conversionId, apiCost);
        return NextResponse.json({ success: true });
      }

      case 'upgrade-tier': {
        const { newTier } = params;
        if (!newTier || !['free', 'premium', 'enterprise'].includes(newTier)) {
          return NextResponse.json(
            { error: 'Valid newTier is required (free, premium, enterprise)' },
            { status: 400 }
          );
        }

        const updatedUsage = await UsageTrackingService.upgradeUserTier(user.id, newTier);
        return NextResponse.json({ usage: updatedUsage });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: check-limits, record-conversion, or upgrade-tier' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}