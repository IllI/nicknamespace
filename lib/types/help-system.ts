/**
 * Types for the help system and user onboarding
 */

export interface TourStep {
  id: string;
  target: string; // CSS selector for the element to highlight
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    type: 'click' | 'input' | 'wait';
    value?: string;
    duration?: number;
  };
  showNext?: boolean;
  showPrev?: boolean;
  showSkip?: boolean;
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  category: 'onboarding' | 'feature' | 'troubleshooting';
  steps: TourStep[];
  prerequisites?: string[];
  estimatedDuration: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime: number; // in minutes
  lastUpdated: string;
  relatedArticles?: string[];
  videoUrl?: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: 'pdf' | 'image' | 'video' | 'file';
  }>;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  popularity: number;
  lastUpdated: string;
}

export interface ContextualHelp {
  id: string;
  trigger: string; // CSS selector or page path
  title: string;
  content: string;
  type: 'tooltip' | 'popover' | 'modal' | 'inline';
  position?: 'top' | 'bottom' | 'left' | 'right';
  showCondition?: {
    userType?: 'new' | 'returning' | 'experienced';
    featureUsage?: number; // times feature has been used
    timeOnPage?: number; // seconds
  };
}

export interface UserProgress {
  userId: string;
  completedTours: string[];
  viewedArticles: string[];
  dismissedHelp: string[];
  preferences: {
    showTooltips: boolean;
    showOnboarding: boolean;
    helpLevel: 'minimal' | 'standard' | 'detailed';
  };
  lastActivity: string;
}

export interface HelpSearchResult {
  type: 'article' | 'faq' | 'tour';
  id: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
  category: string;
  url: string;
}