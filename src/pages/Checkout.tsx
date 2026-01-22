
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckoutButton } from '../components/payment/CheckoutButton';

type PlanKey = 'starter' | 'professional' | 'enterprise';

type PlanConfig = {
  name: string;
  price: string;
  description: string;
  features: string[];
  priceId?: string;
  priceLookupKey?: string;
};

const PLAN_CONFIGS: Record<PlanKey, PlanConfig> = {
  starter: {
    name: 'Starter',
    price: '$9',
    priceLookupKey: 'starter_monthly',
    description: 'Perfect for getting started',
    features: [
      'Up to 5 projects',
      'Basic authentication',
      'Community support',
      '1GB storage'
    ]
  },
  professional: {
    name: 'Professional',
    price: '$29',
    priceLookupKey: 'pro_monthly',
    description: 'Best for growing businesses',
    features: [
      'Unlimited projects',
      'Advanced authentication',
      'Priority support',
      '10GB storage',
      'Custom domains',
      'Analytics dashboard'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    price: '$99',
    priceId: 'price_enterprise_monthly',
    description: 'For large-scale applications',
    features: [
      'Everything in Professional',
      'Dedicated support',
      'Custom integrations',
      '100GB storage',
      'Advanced security',
      'SLA guarantee'
    ]
  }
};

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  
  const planKey = searchParams.get('plan') || 'professional';
  const plan = PLAN_CONFIGS[planKey as keyof typeof PLAN_CONFIGS] || PLAN_CONFIGS.professional;

  const handleCheckoutError = (errorMessage: string) => {
    try {
      setError(errorMessage);
      // Log error for debugging
      console.error('Checkout error:', errorMessage);
    } catch (err) {
      console.error('Failed to handle checkout error:', err);
    }
  };

  const handleCheckoutSuccess = () => {
    try {
      setError(null);
      // Handle successful checkout
      console.log('Checkout completed successfully');
    } catch (err) {
      console.error('Failed to handle checkout success:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        <p className="text-gray-600">Complete your subscription purchase.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Payment Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Subscription Plan</h2>

        <div className="border rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-medium text-gray-900">{plan.name} Plan</h3>
              <p className="text-gray-600">{plan.description}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{plan.price}</p>
              <p className="text-gray-600">per month</p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-2">Included features:</h4>
            <ul className="space-y-1">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center text-sm text-gray-600">
                  <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <CheckoutButton
          priceId={plan.priceId}
          priceLookupKey={plan.priceLookupKey}
          onError={handleCheckoutError}
          onSuccess={handleCheckoutSuccess}
        >
          Subscribe Now
        </CheckoutButton>
      </div>
    </div>
  );
}
