// Feature configuration
// This file is auto-generated based on your project settings

export const FEATURE_CONFIG = {
  payment: {
    enabled: true,
    dormant: false,
  },
  ai: {
    enabled: false,
    dormant: true,
  },
  auth: {
    enabled: false,
    dormant: true,
  },
};

export const getFeatureConfig = (feature: string) => {
  return FEATURE_CONFIG[feature as keyof typeof FEATURE_CONFIG];
};

export const isFeatureEnabled = (feature: string) => {
  const config = getFeatureConfig(feature);
  return config?.enabled ?? false;
};

export const isFeatureDormant = (feature: string) => {
  const config = getFeatureConfig(feature);
  return config?.dormant ?? true;
};
