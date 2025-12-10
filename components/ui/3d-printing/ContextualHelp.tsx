'use client';

import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, X, Info, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ContextualHelp as ContextualHelpType } from '@/lib/types/help-system';
import { helpSystem } from '@/lib/services/help-system-service';

interface ContextualHelpProviderProps {
  children: React.ReactNode;
  userId?: string;
}

interface HelpTooltipProps {
  trigger: string;
  title: string;
  content: string;
  type?: 'tooltip' | 'popover' | 'modal' | 'inline';
  position?: 'top' | 'bottom' | 'left' | 'right';
  onDismiss?: () => void;
}

interface HelpTriggerProps {
  helpId: string;
  children: React.ReactNode;
  className?: string;
}

// Context for managing help state
const ContextualHelpContext = React.createContext<{
  showHelp: (helpId: string) => void;
  hideHelp: (helpId: string) => void;
  dismissHelp: (helpId: string) => void;
  isHelpVisible: (helpId: string) => boolean;
}>({
  showHelp: () => {},
  hideHelp: () => {},
  dismissHelp: () => {},
  isHelpVisible: () => false
});

export function ContextualHelpProvider({ children, userId }: ContextualHelpProviderProps) {
  const [visibleHelp, setVisibleHelp] = useState<Set<string>>(new Set());
  const [dismissedHelp, setDismissedHelp] = useState<Set<string>>(new Set());
  const [userProgress, setUserProgress] = useState<any>(null);

  useEffect(() => {
    // Load user progress and dismissed help
    if (userId) {
      helpSystem.getUserProgress(userId).then(setUserProgress);
    }
  }, [userId]);

  const showHelp = (helpId: string) => {
    if (!dismissedHelp.has(helpId)) {
      setVisibleHelp(prev => new Set(prev).add(helpId));
    }
  };

  const hideHelp = (helpId: string) => {
    setVisibleHelp(prev => {
      const newSet = new Set(prev);
      newSet.delete(helpId);
      return newSet;
    });
  };

  const dismissHelp = (helpId: string) => {
    setDismissedHelp(prev => new Set(prev).add(helpId));
    hideHelp(helpId);
    
    if (userId) {
      helpSystem.dismissHelp(userId, helpId);
    }
  };

  const isHelpVisible = (helpId: string) => {
    return visibleHelp.has(helpId);
  };

  return (
    <ContextualHelpContext.Provider value={{
      showHelp,
      hideHelp,
      dismissHelp,
      isHelpVisible
    }}>
      {children}
      <HelpOverlayManager 
        userProgress={userProgress}
        visibleHelp={visibleHelp}
        onDismiss={dismissHelp}
      />
    </ContextualHelpContext.Provider>
  );
}

function HelpOverlayManager({ 
  userProgress, 
  visibleHelp, 
  onDismiss 
}: {
  userProgress: any;
  visibleHelp: Set<string>;
  onDismiss: (helpId: string) => void;
}) {
  const [activeHelp, setActiveHelp] = useState<ContextualHelpType[]>([]);

  useEffect(() => {
    // Check for contextual help based on current page elements
    const checkForHelp = () => {
      const allHelp = helpSystem.getContextualHelp('', userProgress);
      const relevantHelp = allHelp.filter(help => {
        const element = document.querySelector(help.trigger);
        return element && visibleHelp.has(help.id);
      });
      setActiveHelp(relevantHelp);
    };

    checkForHelp();
    
    // Set up observer for DOM changes
    const observer = new MutationObserver(checkForHelp);
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    return () => observer.disconnect();
  }, [userProgress, visibleHelp]);

  return (
    <>
      {activeHelp.map(help => (
        <HelpTooltip
          key={help.id}
          trigger={help.trigger}
          title={help.title}
          content={help.content}
          type={help.type}
          position={help.position}
          onDismiss={() => onDismiss(help.id)}
        />
      ))}
    </>
  );
}

function HelpTooltip({ 
  trigger, 
  title, 
  content, 
  type = 'tooltip', 
  position = 'top',
  onDismiss 
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Element | null>(null);

  useEffect(() => {
    const targetElement = document.querySelector(trigger);
    if (targetElement) {
      targetRef.current = targetElement;
      setIsVisible(true);
      updatePosition();
    }

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [trigger]);

  const updatePosition = () => {
    if (!targetRef.current || !tooltipRef.current) return;

    const targetRect = targetRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - 10;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + 10;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - 10;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + 10;
        break;
    }

    // Keep tooltip within viewport
    top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));

    setTooltipPosition({ top, left });
  };

  if (!isVisible) return null;

  if (type === 'modal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-lg">{title}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-gray-700 mb-4">{content}</p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onDismiss}>
                Got it
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (type === 'inline') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">{title}</h4>
            <p className="text-blue-800 text-sm">{content}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onDismiss}
            className="text-blue-600 hover:text-blue-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 max-w-xs"
      style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
    >
      <Card className="bg-white shadow-lg border border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-2">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              <h4 className="font-medium text-sm">{title}</h4>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onDismiss}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-sm text-gray-700">{content}</p>
        </CardContent>
      </Card>

      {/* Arrow */}
      <div className={`absolute w-2 h-2 bg-white border border-blue-200 transform rotate-45 ${getArrowClasses(position)}`} />
    </div>
  );
}

function getArrowClasses(position: string): string {
  switch (position) {
    case 'top':
      return 'bottom-[-5px] left-1/2 -translate-x-1/2 border-t-0 border-l-0';
    case 'bottom':
      return 'top-[-5px] left-1/2 -translate-x-1/2 border-b-0 border-r-0';
    case 'left':
      return 'right-[-5px] top-1/2 -translate-y-1/2 border-l-0 border-b-0';
    case 'right':
      return 'left-[-5px] top-1/2 -translate-y-1/2 border-r-0 border-t-0';
    default:
      return '';
  }
}

// Hook for using contextual help
export function useContextualHelp() {
  const context = React.useContext(ContextualHelpContext);
  if (!context) {
    throw new Error('useContextualHelp must be used within ContextualHelpProvider');
  }
  return context;
}

// Component for triggering help
export function HelpTrigger({ helpId, children, className }: HelpTriggerProps) {
  const { showHelp, hideHelp, isHelpVisible } = useContextualHelp();
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    showHelp(helpId);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTimeout(() => {
      if (!isHovered) {
        hideHelp(helpId);
      }
    }, 100);
  };

  return (
    <div 
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

// Quick help button component
interface QuickHelpButtonProps {
  helpId: string;
  className?: string;
}

export function QuickHelpButton({ helpId, className }: QuickHelpButtonProps) {
  const { showHelp, isHelpVisible } = useContextualHelp();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => showHelp(helpId)}
      className={`text-gray-400 hover:text-gray-600 ${className}`}
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  );
}

// Auto-show help based on user behavior
export function useAutoHelp(trigger: string, delay: number = 3000) {
  const { showHelp } = useContextualHelp();
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    if (hasShown) return;

    const timer = setTimeout(() => {
      const element = document.querySelector(trigger);
      if (element) {
        showHelp(`auto-${trigger}`);
        setHasShown(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [trigger, delay, showHelp, hasShown]);
}