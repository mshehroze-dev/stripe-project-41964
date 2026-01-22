
/**
 * Payment processing utility functions
 * Helper functions for common payment operations, formatting, and calculations
 */

import {
  SubscriptionPlan,
  UserSubscription,
  SubscriptionStatus,
  PaymentStatus,
  PaymentHistory as PaymentHistoryType,
} from "./payment-types";
import { supabase } from "./supabase";

const requireSupabase = () => {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
};

/**
 * Format currency amount for display
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  options: {
    showSymbol?: boolean;
    showCents?: boolean;
    locale?: string;
  } = {}
): string {
  const { showSymbol = true, showCents = true, locale = "en-US" } = options;

  const formatOptions: Intl.NumberFormatOptions = {
    style: showSymbol ? "currency" : "decimal",
    currency: currency.toUpperCase(),
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  };

  // Convert from cents to dollars
  const displayAmount = amount / 100;

  return new Intl.NumberFormat(locale, formatOptions).format(displayAmount);
}

/**
 * Format Date for display
 */
export function formatDate(
  date: Date | string,
  options: {
    locale?: string;
    dateStyle?: "full" | "long" | "medium" | "short";
  } = {}
): string {
  const { locale = "en-US", dateStyle = "medium" } = options;

  const dateObj = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat(locale, {
    dateStyle,
  }).format(dateObj);
}

/**
 * Format date and time for display
 */
export function formatDateTime(
  date: Date | string,
  options: {
    locale?: string;
    dateStyle?: "full" | "long" | "medium" | "short";
    timeStyle?: "full" | "long" | "medium" | "short";
  } = {}
): string {
  const {
    locale = "en-US",
    dateStyle = "medium",
    timeStyle = "short",
  } = options;

  const dateObj = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    timeStyle,
  }).format(dateObj);
}

/**
 * Calculate discount amount based on promo code
 */
export function calculateDiscount(
  amount: number,
  discountType: "percentage" | "fixed",
  discountValue: number,
  _currency: string = "USD"
): {
  discountAmount: number;
  finalAmount: number;
  discountPercentage: number;
} {
  let discountAmount: number;

  if (discountType === "percentage") {
    // Ensure percentage is between 0 and 100
    const validPercentage = Math.max(0, Math.min(100, discountValue));
    discountAmount = Math.round((amount * validPercentage) / 100);
  } else {
    // Fixed amount discount
    discountAmount = Math.min(discountValue, amount); // Can't discount more than the total
  }

  const finalAmount = Math.max(0, amount - discountAmount);
  const discountPercentage = amount > 0 ? (discountAmount / amount) * 100 : 0;

  return {
    discountAmount,
    finalAmount,
    discountPercentage: Math.round(discountPercentage * 100) / 100, // Round to 2 decimal places
  };
}

/**
 * Calculate subscription pricing with trial and discounts
 */
export function calculateSubscriptionPricing(
  plan: SubscriptionPlan,
  options: {
    trialDays?: number;
    promoCode?: {
      discountType: "percentage" | "fixed";
      discountValue: number;
    };
    billingCycles?: number;
  } = {}
): {
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  trialDays: number;
  nextBillingDate: Date;
  totalSavings: number;
} {
  const {
    trialDays = plan.trialPeriodDays || 0,
    promoCode,
    billingCycles = 1,
  } = options;

  const baseAmount = plan.price * billingCycles;
  let discountAmount = 0;
  let totalSavings = 0;

  // Apply promo code discount
  if (promoCode) {
    const discount = calculateDiscount(
      baseAmount,
      promoCode.discountType,
      promoCode.discountValue,
      plan.currency
    );
    discountAmount = discount.discountAmount;
    totalSavings += discountAmount;
  }

  const finalAmount = baseAmount - discountAmount;

  // Calculate next billing date
  const nextBillingDate = new Date();
  nextBillingDate.setDate(nextBillingDate.getDate() + trialDays);

  // Add billing interval
  if (plan.interval === "month") {
    nextBillingDate.setMonth(
      nextBillingDate.getMonth() + plan.intervalCount * billingCycles
    );
  } else if (plan.interval === "year") {
    nextBillingDate.setFullYear(
      nextBillingDate.getFullYear() + plan.intervalCount * billingCycles
    );
  }

  return {
    baseAmount,
    discountAmount,
    finalAmount,
    trialDays,
    nextBillingDate,
    totalSavings,
  };
}

/**
 * Get subscription status display information
 */
export function getSubscriptionStatusInfo(status: SubscriptionStatus): {
  label: string;
  color: "green" | "yellow" | "red" | "gray";
  description: string;
  actionRequired: boolean;
} {
  switch (status) {
    case "active":
      return {
        label: "Active",
        color: "green",
        description: "Your subscription is active and current",
        actionRequired: false,
      };
    case "trialing":
      return {
        label: "Trial",
        color: "yellow",
        description: "You are currently in your trial period",
        actionRequired: false,
      };
    case "past_due":
      return {
        label: "Past Due",
        color: "red",
        description: "Payment failed. Please update your payment method",
        actionRequired: true,
      };
    case "canceled":
      return {
        label: "Canceled",
        color: "gray",
        description: "Your subscription has been canceled",
        actionRequired: false,
      };
    case "unpaid":
      return {
        label: "Unpaid",
        color: "red",
        description: "Payment is required to continue service",
        actionRequired: true,
      };
    case "incomplete":
      return {
        label: "Incomplete",
        color: "yellow",
        description: "Subscription setup needs to be completed",
        actionRequired: true,
      };
    case "incomplete_expired":
      return {
        label: "Expired",
        color: "red",
        description: "Subscription setup expired. Please try again",
        actionRequired: true,
      };
    default:
      return {
        label: "Unknown",
        color: "gray",
        description: "Subscription status is unknown",
        actionRequired: false,
      };
  }
}

/**
 * Check if subscription is active and usable
 */
export function isSubscriptionActive(
  subscription: UserSubscription | null
): boolean {
  if (!subscription) return false;

  const activeStatuses: SubscriptionStatus[] = ["active", "trialing"];
  return activeStatuses.includes(subscription.status);
}

/**
 * Check if subscription is in trial period
 */
export function isSubscriptionInTrial(subscription: UserSubscription): boolean {
  if (subscription.status !== "trialing") return false;

  if (!subscription.trialEnd) return false;

  return new Date() < subscription.trialEnd;
}

/**
 * Subscription needs attention
 */
export function subscriptionNeedsAttention(
  subscription: UserSubscription | null
): boolean {
  if (!subscription) return false;

  const attentionStatuses: SubscriptionStatus[] = [
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
  ];
  return attentionStatuses.includes(subscription.status);
}

/**
 * Get days until subscription ends
 */
export function getDaysUntilSubscriptionEnd(
  subscription: UserSubscription
): number {
  const now = new Date();
  const subscriptionEnd = subscription.currentPeriodEnd;
  const diffTime = subscriptionEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Is In Trial
 */
export function isInTrial(subscription: UserSubscription): boolean {
  return (
    subscription.status === "trialing" &&
    subscription.trialEnd !== undefined &&
    new Date() < subscription.trialEnd
  );
}

/**
 * Fetch Subscription Status
 */
export async function fetchSubscriptionStatus(
  userId: string
): Promise<{ status: SubscriptionStatus; subscription: any | null; customer: any | null }> {
  try {
    const client = requireSupabase();
    const { data: customer, error: customerError } = await client
      .from("customers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }
    if (!customer) {
      return { status: "canceled", subscription: null, customer: null };
    }

    const { data: subscription, error: subError } = await client
      .from("subscriptions")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      throw subError;
    }

    const status = (subscription?.status as SubscriptionStatus) || "canceled";
    return { status, subscription: subscription || null, customer };
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    return { status: "canceled", subscription: null, customer: null };
  }
}

/**
 * Create Customer Portal Session
 */
export function createCustomerPortalSession(
  customerId: string
): Promise<{ url: string }> {
  const client = requireSupabase();
  return client.functions
    .invoke("create-customer-portal", {
      body: { customerId, returnUrl: typeof window !== "undefined" ? window.location.href : "" },
    })
    .then(({ data, error }) => {
      if (error) {
        throw error;
      }
      return { url: data?.url as string };
    })
    .catch((error) => {
      console.error("Error creating customer portal session:", error);
      throw error;
    });
}

/**
 * Get days remaining in trial
 */
export function getTrialDaysRemaining(subscription: UserSubscription): number {
  if (!isSubscriptionInTrial(subscription) || !subscription.trialEnd) return 0;

  const now = new Date();
  const trialEnd = subscription.trialEnd;
  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Get days until next billing
 */
export function getDaysUntilNextBilling(
  subscription: UserSubscription
): number {
  const now = new Date();
  const nextBilling = subscription.currentPeriodEnd;
  const diffTime = nextBilling.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Calculate prorated amount for subscription changes
 */
export function calculateProration(
  currentPlan: SubscriptionPlan,
  newPlan: SubscriptionPlan,
  daysRemaining: number
): {
  creditAmount: number;
  chargeAmount: number;
  netAmount: number;
  isUpgrade: boolean;
} {
  // Calculate daily rates
  const currentDailyRate =
    currentPlan.price / (currentPlan.interval === "month" ? 30 : 365);
  const newDailyRate =
    newPlan.price / (newPlan.interval === "month" ? 30 : 365);

  // Calculate credit for unused time on current plan
  const creditAmount = Math.round(currentDailyRate * daysRemaining);

  // Calculate charge for remaining time on new plan
  const chargeAmount = Math.round(newDailyRate * daysRemaining);

  // Net amount (positive = charge, negative = credit)
  const netAmount = chargeAmount - creditAmount;

  // Determine if this is an upgrade or downgrade
  const isUpgrade =
    newPlan.tier > currentPlan.tier || newPlan.price > currentPlan.price;

  return {
    creditAmount,
    chargeAmount,
    netAmount,
    isUpgrade,
  };
}

/**
 * Generate subscription summary for display
 */
export function generateSubscriptionSummary(subscription: UserSubscription): {
  planName: string;
  status: string;
  statusColor: "green" | "yellow" | "red" | "gray";
  nextBillingDate: string;
  nextBillingAmount: string;
  daysUntilBilling: number;
  trialInfo?: {
    isInTrial: boolean;
    daysRemaining: number;
  };
  actionRequired: boolean;
} {
  const statusInfo = getSubscriptionStatusInfo(subscription.status);
  const daysUntilBilling = getDaysUntilNextBilling(subscription);
  const isInTrial = isSubscriptionInTrial(subscription);

  let trialInfo;
  if (isInTrial) {
    trialInfo = {
      isInTrial: true,
      daysRemaining: getTrialDaysRemaining(subscription),
    };
  }

  return {
    planName: subscription.plan?.name || "Unknown Plan",
    status: statusInfo.label,
    statusColor: statusInfo.color,
    nextBillingDate: subscription.currentPeriodEnd.toLocaleDateString(),
    nextBillingAmount: subscription.plan
      ? formatCurrency(subscription.plan.price, subscription.plan.currency)
      : "$0.00",
    daysUntilBilling,
    trialInfo,
    actionRequired: statusInfo.actionRequired,
  };
}

/**
 * Sort subscription plans by price and tier
 */
export function sortSubscriptionPlans(
  plans: SubscriptionPlan[],
  sortBy: "price" | "tier" | "name" = "tier",
  order: "asc" | "desc" = "asc"
): SubscriptionPlan[] {
  return [...plans].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "price":
        comparison = a.price - b.price;
        break;
      case "tier":
        comparison = a.tier - b.tier;
        break;
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
    }

    return order === "asc" ? comparison : -comparison;
  });
}

/**
 * Filter plans based on criteria
 */
export function filterSubscriptionPlans(
  plans: SubscriptionPlan[],
  criteria: {
    active?: boolean;
    interval?: "month" | "year";
    maxPrice?: number;
    minPrice?: number;
    features?: string[];
  }
): SubscriptionPlan[] {
  return plans.filter((plan) => {
    if (criteria.active !== undefined && plan.active !== criteria.active) {
      return false;
    }

    if (criteria.interval && plan.interval !== criteria.interval) {
      return false;
    }

    if (criteria.maxPrice !== undefined && plan.price > criteria.maxPrice) {
      return false;
    }

    if (criteria.minPrice !== undefined && plan.price < criteria.minPrice) {
      return false;
    }

    if (criteria.features && criteria.features.length > 0) {
      const hasAllFeatures = criteria.features.every((feature) =>
        plan.features.includes(feature)
      );
      if (!hasAllFeatures) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Generate payment receipt data
 */
export function generatePaymentReceipt(payment: {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  customerEmail?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}): {
  receiptNumber: string;
  formattedAmount: string;
  formattedDate: string;
  description: string;
  customerInfo: string;
  lineItems: Array<{
    description: string;
    amount: string;
  }>;
} {
  const receiptNumber = `RCP-${payment.id.slice(-8).toUpperCase()}`;
  const formattedAmount = formatCurrency(payment.amount, payment.currency);
  const formattedDate = new Date(payment.createdAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  const description = payment.description || "Payment";
  const customerInfo = payment.customerEmail || "N/A";

  const lineItems = [
    {
      description,
      amount: formattedAmount,
    },
  ];

  return {
    receiptNumber,
    formattedAmount,
    formattedDate,
    description,
    customerInfo,
    lineItems,
  };
}

/**
 * Validate subscription plan compatibility
 */
export function validatePlanChange(
  currentPlan: SubscriptionPlan,
  newPlan: SubscriptionPlan
): {
  valid: boolean;
  warnings: string[];
  errors: string[];
  changeType: "upgrade" | "downgrade" | "lateral";
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  let valid = true;

  // Determine change type
  let changeType: "upgrade" | "downgrade" | "lateral";
  if (newPlan.tier > currentPlan.tier) {
    changeType = "upgrade";
  } else if (newPlan.tier < currentPlan.tier) {
    changeType = "downgrade";
  } else {
    changeType = "lateral";
  }

  // Check if new plan is active
  if (!newPlan.active) {
    errors.push("Selected plan is not currently available");
    valid = false;
  }

  // Check for interval changes
  if (currentPlan.interval !== newPlan.interval) {
    warnings.push(
      `Billing interval will change from ${currentPlan.interval}ly to ${newPlan.interval}ly`
    );
  }

  // Check for significant price changes
  const priceChange =
    ((newPlan.price - currentPlan.price) / currentPlan.price) * 100;
  if (Math.abs(priceChange) > 50) {
    warnings.push(`Price will change by ${Math.round(priceChange)}%`);
  }

  // Check for feature downgrades
  if (changeType === "downgrade") {
    const lostFeatures = currentPlan.features.filter(
      (feature) => !newPlan.features.includes(feature)
    );
    if (lostFeatures.length > 0) {
      warnings.push(`You will lose access to: ${lostFeatures.join(", ")}`);
    }
  }

  return {
    valid,
    warnings,
    errors,
    changeType,
  };
}

/**
 * Generate billing period description
 */
export function getBillingPeriodDescription(
  interval: "month" | "year",
  intervalCount: number = 1
): string {
  if (intervalCount === 1) {
    return interval === "month" ? "Monthly" : "Yearly";
  }

  const unit = interval === "month" ? "month" : "year";
  const plural = intervalCount > 1 ? `${unit}s` : unit;

  return `Every ${intervalCount} ${plural}`;
}

/**
 * Calculate annual savings for yearly plans
 */
export function calculateAnnualSavings(
  monthlyPrice: number,
  yearlyPrice: number
): {
  monthlySavings: number;
  annualSavings: number;
  savingsPercentage: number;
  formattedSavings: string;
} {
  const annualCostIfMonthly = monthlyPrice * 12;
  const annualSavings = annualCostIfMonthly - yearlyPrice;
  const monthlySavings = annualSavings / 12;
  const savingsPercentage = (annualSavings / annualCostIfMonthly) * 100;

  return {
    monthlySavings,
    annualSavings,
    savingsPercentage: Math.round(savingsPercentage),
    formattedSavings: formatCurrency(annualSavings),
  };
}

/**
 * Generate plan comparison data
 */
export function generatePlanComparison(plans: SubscriptionPlan[]): {
  features: string[];
  planFeatures: Record<string, boolean>[];
} {
  // Get all unique features across all plans
  const allFeatures = [
    ...new Set(plans.flatMap((plan) => plan.features)),
  ].sort();

  // Create feature matrix for each plan
  const planFeatures = plans.map((plan) => {
    const features: Record<string, boolean> = {};
    allFeatures.forEach((feature) => {
      features[feature] = plan.features.includes(feature);
    });
    return features;
  });

  return {
    features: allFeatures,
    planFeatures,
  };
}

/**
 * Utility to safely parse Stripe webhook data
 */
export function parseWebhookData<T = any>(rawData: any): T | null {
  try {
    if (typeof rawData === "string") {
      return JSON.parse(rawData);
    }
    return rawData as T;
  } catch (error) {
    console.error("Failed to parse webhook data:", error);
    return null;
  }
}

/**
 * Generate unique transaction reference
 */
export function generateTransactionReference(prefix: string = "TXN"): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Get Payment Status Badge
 */
export function getPaymentStatusBadge(status: PaymentStatus): string {
  switch (status) {
    case "succeeded":
      return "success";
    case "failed":
      return "error";
    case "pending":
      return "warning";
    default:
      return "default";
  }
}

/**
 * Fetch Payment History
 */
export async function fetchPaymentHistory(
  customerId: string,
  limit: number = 10
): Promise<PaymentHistoryType[]> {
  try {
    const response = await fetch(
      `/api/payments/history?customerId=${customerId}&limit=${limit}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch payment history");
    }
    const data = await response.json();
    return data.payments as PaymentHistoryType[];
  } catch (error) {
    console.error("Error fetching payment history:", error);
    return [];
  }
}

/**
 * Handle Stripe Errors
 */
export function handleStripeError(error: any): {
  message: string;
  code?: string;
} {
  if (error && error.type === "StripeCardError") {
    return { message: error.message, code: error.code };
  }
  return { message: "An unexpected error occurred. Please try again later." };
}

/**
 * Get Subscription Status Badge
 */
export function getSubscriptionStatusBadge(status: SubscriptionStatus): string {
  switch (status) {
    case "active":
      return "success";
    case "trialing":
      return "info";
    case "past_due":
      return "warning";
    case "canceled":
    case "unpaid":
      return "error";
    default:
      return "default";
  }
}
