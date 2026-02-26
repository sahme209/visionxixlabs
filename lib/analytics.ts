/**
 * Analytics utility for tracking user events
 * Uses Vercel Analytics for event tracking
 */

// Track custom events using Vercel Analytics
export function trackEvent(name: string, properties?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  
  try {
    // Vercel Analytics track function
    if (window.va) {
      window.va('track', name, properties);
    }
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', name, properties);
    }
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error);
  }
}

// Specific event tracking functions
export const analytics = {
  // Onboarding events
  onboardingStarted: () => trackEvent('onboarding_started'),
  onboardingStepCompleted: (step: number, stepName: string) => 
    trackEvent('onboarding_step_completed', { step, stepName }),
  onboardingCompleted: (formType?: string) => 
    trackEvent('onboarding_completed', { formType }),
  onboardingAbandoned: (step: number) => 
    trackEvent('onboarding_abandoned', { step }),
  
  // Profile setup events
  profileSetupStarted: () => trackEvent('profile_setup_started'),
  profileSetupCompleted: (formType: string) => 
    trackEvent('profile_setup_completed', { formType }),
  profileSetupAbandoned: (step: string) => 
    trackEvent('profile_setup_abandoned', { step }),
  
  // Authentication events
  loginStarted: () => trackEvent('login_started'),
  loginCompleted: (method: string) => 
    trackEvent('login_completed', { method }),
  signupStarted: () => trackEvent('signup_started'),
  signupCompleted: (method: string) => 
    trackEvent('signup_completed', { method }),
  
  // Feature usage
  statsPageViewed: () => trackEvent('stats_page_viewed'),
  guidesPageViewed: () => trackEvent('guides_page_viewed'),
  helpCenterViewed: () => trackEvent('help_center_viewed'),
  caseToolsViewed: () => trackEvent('case_tools_viewed'),
  
  // Conversion events
  subscriptionStarted: (plan: string) => 
    trackEvent('subscription_started', { plan }),
  subscriptionCompleted: (plan: string) => 
    trackEvent('subscription_completed', { plan }),
  
  // Engagement events
  guideOpened: (guideId: string, guideName: string) => 
    trackEvent('guide_opened', { guideId, guideName }),
  guideStepCompleted: (guideId: string, stepNumber: number) => 
    trackEvent('guide_step_completed', { guideId, stepNumber }),
  
  // Error tracking
  errorOccurred: (errorType: string, errorMessage: string, page: string) => 
    trackEvent('error_occurred', { errorType, errorMessage, page }),
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    va?: (action: string, eventName: string, properties?: Record<string, any>) => void;
  }
}
