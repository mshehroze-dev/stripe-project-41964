
// User types
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}


// Subscription types
export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  status: 'active' | 'canceled' | 'incomplete' | 'past_due';
  price_id: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  stripe_price_id: string;
  features: string[];
}


// AI types
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  messages: AIMessage[];
  created_at: string;
  updated_at: string;
}


// Landing page types
export interface SectionConfig {
  type: 'hero' | 'features' | 'pricing' | 'faq';
  headline?: string;
  sub?: string;
  cta_text?: string;
  items?: Array<{
    title: string;
    desc: string;
    price?: string;
  }>;
}
