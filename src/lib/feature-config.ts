// Feature configuration
// Auto-generated feature management configuration
// This file provides utilities to check feature status and manage dormant features

export interface FeatureConfig {
  enabled: boolean;
  dormant: boolean;
  name: string;
  description: string;
}

export const FEATURE_DEFINITIONS: Record<string, FeatureConfig> = {
  payment: {
    enabled: true,
    dormant: false,
    name: 'Payment & Billing',
    description: 'Stripe integration with subscriptions, billing, and payment processing',
  },
  ai: {
    enabled: false,
    dormant: true,
    name: 'AI Assistant',
    description: 'AI-powered features including content generation and assistant functionality',
  },
  auth: {
    enabled: false,
    dormant: true,
    name: 'Authentication',
    description: 'User authentication with login, signup, and protected routes',
  },
};

// Environment-based feature detection
export const getFeatureStatus = (feature: string): FeatureConfig | null => {
  const config = FEATURE_DEFINITIONS[feature];
  if (!config) return null;
  
  // Check environment variable override
  const envVar = `VITE_${feature.toUpperCase()}_ENABLED`;
  const envEnabled = import.meta.env[envVar] === 'true';
  
  return {
    ...config,
    enabled: envEnabled,
    dormant: !envEnabled,
  };
};

// Utility functions
export const isFeatureEnabled = (feature: string): boolean => {
  const status = getFeatureStatus(feature);
  return status?.enabled ?? false;
};

export const isFeatureDormant = (feature: string): boolean => {
  const status = getFeatureStatus(feature);
  return status?.dormant ?? true;
};

export const getActiveFeatures = (): string[] => {
  return Object.keys(FEATURE_DEFINITIONS).filter(isFeatureEnabled);
};

export const getDormantFeatures = (): string[] => {
  return Object.keys(FEATURE_DEFINITIONS).filter(isFeatureDormant);
};

export const getAllFeatures = (): string[] => {
  return Object.keys(FEATURE_DEFINITIONS);
};

// Feature-specific utilities
export const isPaymentEnabled = (): boolean => isFeatureEnabled('payment');
export const isAIEnabled = (): boolean => isFeatureEnabled('ai');
export const isAuthEnabled = (): boolean => isFeatureEnabled('auth');

// Development utilities
export const logFeatureStatus = (): void => {
  console.group('🔧 Feature Status');
  Object.keys(FEATURE_DEFINITIONS).forEach(feature => {
    const status = getFeatureStatus(feature);
    const emoji = status?.enabled ? '✅' : '💤';
    console.log(`${emoji} ${status?.name}: ${status?.enabled ? 'Active' : 'Dormant'}`);
  });
  console.groupEnd();
};

// Export feature definitions for external use
export default FEATURE_DEFINITIONS;
