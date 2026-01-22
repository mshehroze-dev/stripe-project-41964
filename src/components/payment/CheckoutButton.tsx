
import { useState } from 'react';
import { createSubscription, redirectToCheckout, handleStripeError } from '../../lib/stripe';
interface CheckoutButtonProps {
  priceId?: string;
  priceLookupKey?: string;
  children: React.ReactNode;
  onError?: (error: string) => void;
  onSuccess?: () => void;
  className?: string;
}

export function CheckoutButton({ 
  priceId, 
  priceLookupKey,
  children, 
  onError, 
  onSuccess,
  className = "w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);  const user = null;
  const handleCheckout = async () => {
    if (!priceId && !priceLookupKey) {
      onError?.('Missing price configuration');
      return;
    }

    setLoading(true);

    try {
      console.log('Creating subscription checkout for price:', priceId || priceLookupKey);
      
      // Create subscription checkout session
      const { sessionId } = await createSubscription({
        planId: priceId,
        priceLookupKey,
        customerEmail: user?.email || undefined,
        successUrl: `${window.location.origin}/success?type=subscription`,
        cancelUrl: `${window.location.origin}/checkout`,
        allowPromotionCodes: true,
        collectBillingAddress: true,
      });

      if (!sessionId) {
        throw new Error('Failed to create checkout session');
      }

      console.log('Redirecting to Stripe checkout with session:', sessionId);
      
      // Redirect to Stripe Checkout
      await redirectToCheckout(sessionId);
      
      // Call success callback if redirect doesn't happen immediately
      onSuccess?.();
    } catch (error) {
      console.error('Checkout error:', error);
      const errorMessage = handleStripeError(error);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={className}
    >
      {loading ? 'Processing...' : children}
    </button>
  );
}
