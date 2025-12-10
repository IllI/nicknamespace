'use client';

import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';

interface UsageData {
  daily_conversions: number;
  monthly_conversions: number;
  total_api_cost: number;
  subscription_tier: 'free' | 'premium' | 'enterprise';
  daily_limit: number;
  monthly_limit: number;
}

interface ConversionUsageCardProps {
  user: User;
  className?: string;
}

export default function ConversionUsageCard({ user, className = '' }: ConversionUsageCardProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await fetch('/api/3d-conversion/usage');
        if (!response.ok) {
          throw new Error('Failed to fetch usage data');
        }
        const data = await response.json();
        setUsage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className={`bg-zinc-900 rounded-lg p-6 border border-zinc-800 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-zinc-700 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-zinc-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-zinc-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className={`bg-zinc-900 rounded-lg p-6 border border-zinc-800 ${className}`}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-zinc-400">Unable to load usage data</p>
        </div>
      </div>
    );
  }

  const dailyPercentage = (usage.daily_conversions / usage.daily_limit) * 100;
  const monthlyPercentage = (usage.monthly_conversions / usage.monthly_limit) * 100;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'text-yellow-400';
      case 'enterprise': return 'text-purple-400';
      default: return 'text-zinc-400';
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'bg-yellow-900 text-yellow-300';
      case 'enterprise': return 'bg-purple-900 text-purple-300';
      default: return 'bg-zinc-800 text-zinc-300';
    }
  };

  return (
    <div className={`bg-zinc-900 rounded-lg p-6 border border-zinc-800 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">3D Conversion Usage</h3>
          <p className="text-zinc-400">Track your conversion limits and usage</p>
        </div>
        
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTierBadgeColor(usage.subscription_tier)}`}>
          {usage.subscription_tier.charAt(0).toUpperCase() + usage.subscription_tier.slice(1)}
        </span>
      </div>

      {/* Usage Statistics */}
      <div className="space-y-6">
        {/* Daily Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-zinc-300">Daily Conversions</span>
            <span className="text-sm text-zinc-400">
              {usage.daily_conversions} / {usage.daily_limit}
            </span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                dailyPercentage >= 90 ? 'bg-red-500' :
                dailyPercentage >= 70 ? 'bg-yellow-500' :
                'bg-gradient-to-r from-pink-500 to-violet-500'
              }`}
              style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Monthly Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-zinc-300">Monthly Conversions</span>
            <span className="text-sm text-zinc-400">
              {usage.monthly_conversions} / {usage.monthly_limit}
            </span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                monthlyPercentage >= 90 ? 'bg-red-500' :
                monthlyPercentage >= 70 ? 'bg-yellow-500' :
                'bg-gradient-to-r from-pink-500 to-violet-500'
              }`}
              style={{ width: `${Math.min(monthlyPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Cost Information */}
        <div className="pt-4 border-t border-zinc-800">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-zinc-300">Total API Cost</span>
            <span className="text-sm font-semibold text-white">
              ${usage.total_api_cost.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Link
          href="/3d-conversion"
          className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Conversion
        </Link>
        
        <Link
          href="/3d-conversion/history"
          className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          View History
        </Link>
      </div>

      {/* Upgrade Prompt for Free Tier */}
      {usage.subscription_tier === 'free' && (dailyPercentage > 80 || monthlyPercentage > 80) && (
        <div className="mt-4 p-4 bg-gradient-to-r from-pink-500/10 to-violet-500/10 border border-pink-500/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-pink-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white mb-1">Approaching Limit</h4>
              <p className="text-xs text-zinc-300 mb-3">
                You're running low on conversions. Upgrade for unlimited access and priority processing.
              </p>
              <Link
                href="/"
                className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded text-xs font-medium hover:from-pink-600 hover:to-violet-600 transition-colors"
              >
                Upgrade Plan
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}