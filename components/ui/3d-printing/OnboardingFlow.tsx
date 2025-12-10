'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Play, 
  Book, 
  HelpCircle, 
  ArrowRight,
  Sparkles,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GuidedTour } from './GuidedTour';
import { TourLauncher } from './GuidedTour';
import { helpSystem } from '@/lib/services/help-system-service';

interface OnboardingFlowProps {
  userId: string;
  onComplete?: () => void;
  className?: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  type: 'tour' | 'article' | 'action';
  tourId?: string;
  articleId?: string;
  actionUrl?: string;
  estimatedTime: number;
  isCompleted: boolean;
  isOptional?: boolean;
}

export function OnboardingFlow({ userId, onComplete, className = '' }: OnboardingFlowProps) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeTour, setActiveTour] = useState<string | null>(null);

  useEffect(() => {
    initializeOnboarding();
  }, [userId]);

  const initializeOnboarding = async () => {
    // Check user progress to determine which steps are completed
    const userProgress = await helpSystem.getUserProgress(userId);
    
    const onboardingSteps: OnboardingStep[] = [
      {
        id: 'welcome',
        title: 'Welcome to 3D Printing!',
        description: 'Learn the basics of our 3D printing service',
        type: 'tour',
        tourId: 'first-upload',
        estimatedTime: 5,
        isCompleted: userProgress.completedTours.includes('first-upload')
      },
      {
        id: 'file-formats',
        title: 'Understanding File Formats',
        description: 'Learn about STL, OBJ, and PLY files',
        type: 'article',
        articleId: 'file-formats',
        estimatedTime: 3,
        isCompleted: userProgress.viewedArticles.includes('file-formats')
      },
      {
        id: 'first-upload',
        title: 'Upload Your First Model',
        description: 'Try uploading a 3D model file',
        type: 'action',
        actionUrl: '/3d-printing',
        estimatedTime: 2,
        isCompleted: false // This would be checked against actual upload history
      },
      {
        id: 'print-settings',
        title: 'Understanding Print Settings',
        description: 'Learn about materials, quality, and supports',
        type: 'article',
        articleId: 'print-settings',
        estimatedTime: 7,
        isCompleted: userProgress.viewedArticles.includes('print-settings'),
        isOptional: true
      },
      {
        id: 'advanced-features',
        title: 'Advanced Features Tour',
        description: 'Explore advanced printing options',
        type: 'tour',
        tourId: 'advanced-features',
        estimatedTime: 8,
        isCompleted: userProgress.completedTours.includes('advanced-features'),
        isOptional: true
      }
    ];

    setSteps(onboardingSteps);
    
    // Find first incomplete step
    const firstIncomplete = onboardingSteps.findIndex(step => !step.isCompleted);
    setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : 0);
  };

  const completeStep = (stepId: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, isCompleted: true } : step
    ));

    // Move to next incomplete step
    const nextIncomplete = steps.findIndex((step, index) => 
      index > currentStep && !step.isCompleted
    );
    
    if (nextIncomplete >= 0) {
      setCurrentStep(nextIncomplete);
    } else {
      // All steps completed
      onComplete?.();
    }
  };

  const startStep = (step: OnboardingStep) => {
    switch (step.type) {
      case 'tour':
        if (step.tourId) {
          setActiveTour(step.tourId);
        }
        break;
      case 'article':
        if (step.articleId) {
          window.open(`/help/articles/${step.articleId}`, '_blank');
          // Mark as completed after a delay (assuming user reads it)
          setTimeout(() => completeStep(step.id), 1000);
        }
        break;
      case 'action':
        if (step.actionUrl) {
          window.location.href = step.actionUrl;
        }
        break;
    }
  };

  const skipOnboarding = () => {
    onComplete?.();
  };

  const completedSteps = steps.filter(step => step.isCompleted).length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  if (showWelcome) {
    return (
      <WelcomeScreen 
        onStart={() => setShowWelcome(false)}
        onSkip={skipOnboarding}
        totalSteps={totalSteps}
        estimatedTime={steps.reduce((sum, step) => sum + step.estimatedTime, 0)}
      />
    );
  }

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <Sparkles className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Getting Started</h1>
        </div>
        <p className="text-gray-600 mb-4">
          Complete these steps to master 3D printing with our service
        </p>
        
        {/* Progress */}
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{completedSteps} of {totalSteps} completed</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <OnboardingStepCard
            key={step.id}
            step={step}
            isActive={index === currentStep}
            onStart={() => startStep(step)}
            onComplete={() => completeStep(step.id)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-center space-x-4 mt-8">
        <Button variant="outline" onClick={skipOnboarding}>
          Skip for Now
        </Button>
        {completedSteps === totalSteps && (
          <Button onClick={onComplete}>
            Complete Onboarding
          </Button>
        )}
      </div>

      {/* Active Tour */}
      {activeTour && (
        <GuidedTour
          tourId={activeTour}
          onComplete={() => {
            setActiveTour(null);
            const step = steps.find(s => s.tourId === activeTour);
            if (step) {
              completeStep(step.id);
            }
          }}
          onSkip={() => setActiveTour(null)}
          onClose={() => setActiveTour(null)}
          autoStart={true}
        />
      )}
    </div>
  );
}

function WelcomeScreen({ 
  onStart, 
  onSkip, 
  totalSteps, 
  estimatedTime 
}: {
  onStart: () => void;
  onSkip: () => void;
  totalSteps: number;
  estimatedTime: number;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-4 rounded-full">
              <Sparkles className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to 3D Printing!
          </CardTitle>
          <p className="text-gray-600 text-lg">
            Let's get you started with everything you need to know about our 3D printing service
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* What you'll learn */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">What you'll learn:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">File Upload Process</h4>
                  <p className="text-sm text-gray-600">How to upload and validate 3D models</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Print Settings</h4>
                  <p className="text-sm text-gray-600">Materials, quality, and support options</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Job Tracking</h4>
                  <p className="text-sm text-gray-600">Monitor your print progress in real-time</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Troubleshooting</h4>
                  <p className="text-sm text-gray-600">Common issues and how to solve them</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{totalSteps}</div>
                <div className="text-sm text-gray-600">Steps</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{estimatedTime}</div>
                <div className="text-sm text-gray-600">Minutes</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={onStart} className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              Start Onboarding
            </Button>
            <Button variant="outline" onClick={onSkip} className="flex-1">
              Skip for Now
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            You can always access help and tutorials from the Help Center
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function OnboardingStepCard({ 
  step, 
  isActive, 
  onStart, 
  onComplete 
}: {
  step: OnboardingStep;
  isActive: boolean;
  onStart: () => void;
  onComplete: () => void;
}) {
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'tour':
        return <Play className="h-5 w-5" />;
      case 'article':
        return <Book className="h-5 w-5" />;
      case 'action':
        return <ArrowRight className="h-5 w-5" />;
      default:
        return <HelpCircle className="h-5 w-5" />;
    }
  };

  const getStepColor = () => {
    if (step.isCompleted) return 'text-green-600';
    if (isActive) return 'text-blue-600';
    return 'text-gray-400';
  };

  return (
    <Card className={`transition-all ${isActive ? 'ring-2 ring-blue-500 shadow-md' : ''} ${step.isCompleted ? 'bg-green-50' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          {/* Status Icon */}
          <div className={`flex-shrink-0 ${getStepColor()}`}>
            {step.isCompleted ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <Circle className="h-6 w-6" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  {step.isOptional && (
                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                  )}
                </div>
                <p className="text-gray-600 mb-3">{step.description}</p>
                
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {step.estimatedTime} min
                  </span>
                  <span className="flex items-center">
                    {getStepIcon(step.type)}
                    <span className="ml-1 capitalize">{step.type}</span>
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex-shrink-0 ml-4">
                {step.isCompleted ? (
                  <Badge className="bg-green-100 text-green-800">
                    Completed
                  </Badge>
                ) : (
                  <Button
                    onClick={onStart}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                  >
                    {step.type === 'tour' ? 'Start Tour' : 
                     step.type === 'article' ? 'Read Article' : 
                     'Go to Page'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}