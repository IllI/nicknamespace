'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tour, TourStep } from '@/lib/types/help-system';
import { helpSystem } from '@/lib/services/help-system-service';

interface GuidedTourProps {
  tourId: string;
  onComplete?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  autoStart?: boolean;
}

interface TourOverlayProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export function GuidedTour({ 
  tourId, 
  onComplete, 
  onSkip, 
  onClose,
  autoStart = false 
}: GuidedTourProps) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);

  useEffect(() => {
    const tourData = helpSystem.getTour(tourId);
    setTour(tourData);
    
    if (tourData && autoStart) {
      startTour();
    }
  }, [tourId, autoStart]);

  const startTour = () => {
    setIsActive(true);
    setCurrentStepIndex(0);
    highlightStep(0);
  };

  const highlightStep = (stepIndex: number) => {
    if (!tour || stepIndex >= tour.steps.length) return;

    const step = tour.steps[stepIndex];
    const element = document.querySelector(step.target);
    
    if (element) {
      setHighlightedElement(element);
      
      // Scroll element into view
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });

      // Add highlight class
      element.classList.add('tour-highlight');
      
      // Remove highlight from previous element
      document.querySelectorAll('.tour-highlight').forEach(el => {
        if (el !== element) {
          el.classList.remove('tour-highlight');
        }
      });
    }
  };

  const nextStep = () => {
    if (!tour) return;
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < tour.steps.length) {
      setCurrentStepIndex(nextIndex);
      highlightStep(nextIndex);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      highlightStep(prevIndex);
    }
  };

  const skipTour = () => {
    cleanup();
    onSkip?.();
  };

  const completeTour = () => {
    cleanup();
    if (tour) {
      // Mark tour as completed
      helpSystem.markTourCompleted('current-user', tour.id);
    }
    onComplete?.();
  };

  const closeTour = () => {
    cleanup();
    onClose?.();
  };

  const cleanup = () => {
    setIsActive(false);
    setHighlightedElement(null);
    
    // Remove all highlight classes
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });
  };

  if (!tour || !isActive) {
    return null;
  }

  const currentStep = tour.steps[currentStepIndex];

  return (
    <>
      {/* Overlay backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 tour-overlay" />
      
      {/* Tour step overlay */}
      <TourStepOverlay
        step={currentStep}
        currentStep={currentStepIndex + 1}
        totalSteps={tour.steps.length}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTour}
        onClose={closeTour}
      />

      {/* Tour progress indicator */}
      <div className="fixed top-4 right-4 z-50">
        <Card className="bg-white shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{tour.name}</Badge>
              <span className="text-sm text-gray-600">
                {currentStepIndex + 1} of {tour.steps.length}
              </span>
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / tour.steps.length) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CSS for highlighting */}
      <style jsx global>{`
        .tour-highlight {
          position: relative;
          z-index: 45;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2);
          border-radius: 8px;
        }
        
        .tour-overlay {
          pointer-events: none;
        }
        
        .tour-highlight {
          pointer-events: auto;
        }
      `}</style>
    </>
  );
}

function TourStepOverlay({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onClose
}: TourOverlayProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      const targetElement = document.querySelector(step.target);
      if (targetElement && overlayRef.current) {
        const targetRect = targetElement.getBoundingClientRect();
        const overlayRect = overlayRef.current.getBoundingClientRect();
        
        let top = 0;
        let left = 0;

        switch (step.placement) {
          case 'top':
            top = targetRect.top - overlayRect.height - 10;
            left = targetRect.left + (targetRect.width - overlayRect.width) / 2;
            break;
          case 'bottom':
            top = targetRect.bottom + 10;
            left = targetRect.left + (targetRect.width - overlayRect.width) / 2;
            break;
          case 'left':
            top = targetRect.top + (targetRect.height - overlayRect.height) / 2;
            left = targetRect.left - overlayRect.width - 10;
            break;
          case 'right':
            top = targetRect.top + (targetRect.height - overlayRect.height) / 2;
            left = targetRect.right + 10;
            break;
          case 'center':
          default:
            top = window.innerHeight / 2 - overlayRect.height / 2;
            left = window.innerWidth / 2 - overlayRect.width / 2;
            break;
        }

        // Keep overlay within viewport
        top = Math.max(10, Math.min(top, window.innerHeight - overlayRect.height - 10));
        left = Math.max(10, Math.min(left, window.innerWidth - overlayRect.width - 10));

        setPosition({ top, left });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [step]);

  return (
    <div
      ref={overlayRef}
      className="fixed z-50 max-w-sm"
      style={{ top: position.top, left: position.left }}
    >
      <Card className="bg-white shadow-xl border-2 border-blue-200">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-900">
                {step.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="mb-4">
            <p className="text-gray-700 leading-relaxed">
              {step.content}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {step.showPrev && currentStep > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrev}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
              )}
            </div>

            <div className="flex space-x-2">
              {step.showSkip && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSkip}
                  className="text-gray-500"
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip Tour
                </Button>
              )}
              
              {step.showNext !== false && (
                <Button
                  size="sm"
                  onClick={onNext}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {currentStep === totalSteps ? 'Finish' : 'Next'}
                  {currentStep < totalSteps && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Arrow pointing to target element */}
      {step.placement && step.placement !== 'center' && (
        <div className={`absolute w-3 h-3 bg-white border-2 border-blue-200 transform rotate-45 ${getArrowPosition(step.placement)}`} />
      )}
    </div>
  );
}

function getArrowPosition(placement: string): string {
  switch (placement) {
    case 'top':
      return 'bottom-[-7px] left-1/2 -translate-x-1/2 border-t-0 border-l-0';
    case 'bottom':
      return 'top-[-7px] left-1/2 -translate-x-1/2 border-b-0 border-r-0';
    case 'left':
      return 'right-[-7px] top-1/2 -translate-y-1/2 border-l-0 border-b-0';
    case 'right':
      return 'left-[-7px] top-1/2 -translate-y-1/2 border-r-0 border-t-0';
    default:
      return '';
  }
}

// Tour launcher component
interface TourLauncherProps {
  tourId: string;
  children: React.ReactNode;
  className?: string;
}

export function TourLauncher({ tourId, children, className }: TourLauncherProps) {
  const [showTour, setShowTour] = useState(false);

  const startTour = () => {
    setShowTour(true);
  };

  return (
    <>
      <div className={className} onClick={startTour}>
        {children}
      </div>
      
      {showTour && (
        <GuidedTour
          tourId={tourId}
          onComplete={() => setShowTour(false)}
          onSkip={() => setShowTour(false)}
          onClose={() => setShowTour(false)}
          autoStart={true}
        />
      )}
    </>
  );
}