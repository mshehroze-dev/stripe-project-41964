
/** @manually */import { CheckoutButton } from '@/components/payment/CheckoutButton';
export default function Pricing({ data, className = "" }: { data: any; className?: string }) {
  const plans = data?.plans || [];  const paymentPlans = [];
  const normalizePlanName = (value: string) =>
    value.toLowerCase().replace(/plan/g, '').replace(/[^a-z0-9]/g, '').trim();

  const resolveStripePriceId = (plan: any, index: number) => {
    const directId =
      plan.stripePriceId ||
      plan.stripe_price_id ||
      plan.priceId ||
      plan.price_id ||
      (typeof plan.id === 'string' && plan.id.startsWith('price_') ? plan.id : null);

    if (directId) return directId;

    if (!Array.isArray(paymentPlans) || paymentPlans.length === 0) {
      return null;
    }

    const normalizedName = normalizePlanName(plan.name || '');
    if (normalizedName) {
      const match = paymentPlans.find(
        (stripePlan: any) => normalizePlanName(stripePlan.name || '') === normalizedName
      );
      if (match?.id) return match.id;
    }

    if (paymentPlans.length === plans.length) {
      const fallback = paymentPlans[index];
      if (fallback?.id) return fallback.id;
    }

    return null;
  };
  const resolveStripeLookupKey = (plan: any) =>
    plan.stripeLookupKey ||
    plan.stripe_lookup_key ||
    plan.priceLookupKey ||
    plan.price_lookup_key ||
    plan.lookupKey ||
    null;
  // Determine popular plan (middle plan or explicitly marked)
  const getPopularPlan = () => {
    const popularPlan = plans.find((p: any) => p.popular || p.highlight);
    if (popularPlan) return popularPlan;
    
    // Default to middle plan if 3+ plans exist
    if (plans.length >= 3) {
      const sortedByPrice = [...plans].sort((a: any, b: any) => {
        const priceA = parseFloat(a.price?.replace(/[^0-9.]/g, '') || '0');
        const priceB = parseFloat(b.price?.replace(/[^0-9.]/g, '') || '0');
        return priceA - priceB;
      });
      return sortedByPrice[Math.floor(sortedByPrice.length / 2)];
    }
    return null;
  };

  const popularPlan = getPopularPlan();

  if (plans.length === 0) {
    return (
      <section className={`py-24 sm:py-32 ${className}`}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Choose Your Plan</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">Pricing plans are being updated. Please check back soon.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`py-24 sm:py-32 bg-gray-50 ${className}`}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center lg:max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {data?.title || 'Choose Your Plan'}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            {data?.subtitle || 'Select the perfect plan for your needs. Upgrade or downgrade at any time.'}
          </p>
        </div>

        {/* Pricing Grid */}
        <div className={`mx-auto mt-16 grid max-w-lg gap-8 lg:max-w-4xl ${
          plans.length === 1 ? '' :
          plans.length === 2 ? 'lg:grid-cols-2' :
          'lg:grid-cols-3'
        }`}>
          {plans.map((plan: any, idx: number) => {
            const isPopular = Boolean(
              popularPlan &&
                ((plan.id && popularPlan.id && plan.id === popularPlan.id) ||
                  plan.name === popularPlan.name)
            );            const stripePriceId = resolveStripePriceId(plan, idx);
            const stripeLookupKey = resolveStripeLookupKey(plan);            const ctaLink = plan.ctaLink || plan.cta_link || "#";
            
            return (
              <div
                key={idx}
                className={`relative bg-white rounded-2xl shadow-lg p-8 flex flex-col transition-transform duration-200 hover:scale-105 ${
                  isPopular 
                    ? 'border-2 border-indigo-600 ring-2 ring-indigo-600 ring-opacity-20' 
                    : 'border border-gray-200'
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-medium bg-indigo-600 text-white shadow-lg">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-gray-600 text-sm">{plan.description}</p>
                  )}
                  
                  <div className="mt-4">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900">
                        {plan.price}
                      </span>
                      {plan.interval && (
                        <span className="ml-2 text-lg text-gray-500">
                          /{plan.interval}
                        </span>
                      )}
                    </div>
                    
                    {plan.trial && (
                      <p className="mt-2 text-sm text-indigo-600 font-medium">
                        {plan.trial}
                      </p>
                    )}
                  </div>
                </div>

                {/* Features List */}
                <div className="flex-1 mb-6">
                  <ul className="space-y-3">
                    {(plan.features || []).map((feature: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <svg 
                          className="flex-shrink-0 w-5 h-5 text-indigo-600 mt-0.5" 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path 
                            fillRule="evenodd" 
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                            clipRule="evenodd" 
                          />
                        </svg>
                        <span className="ml-3 text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="mt-auto">
                  {plan.cta && (                    stripePriceId || stripeLookupKey ? (
                      <CheckoutButton
                        priceId={stripePriceId}
                        priceLookupKey={stripeLookupKey || undefined}
                        className={`block w-full rounded-md px-3.5 py-2.5 text-center text-sm font-semibold shadow-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          isPopular
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                            : 'bg-gray-900 text-white hover:bg-gray-800 focus-visible:outline-gray-900'
                        }`}
                      >
                        {plan.cta}
                      </CheckoutButton>
                    ) : (
                      <a
                        href={ctaLink}
                        className={`block w-full rounded-md px-3.5 py-2.5 text-center text-sm font-semibold shadow-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          isPopular
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                            : 'bg-gray-900 text-white hover:bg-gray-800 focus-visible:outline-gray-900'
                        }`}
                      >
                        {plan.cta}
                      </a>
                    )                  )}
                  
                  {plan.secondaryCta && (
                    <a
                      href={plan.secondaryCtaLink || "#"}
                      className="mt-3 block w-full text-center px-3.5 py-2.5 text-sm font-semibold text-gray-600 transition-colors duration-200 hover:text-gray-900"
                    >
                      {plan.secondaryCta}
                    </a>
                  )}
                </div>

                {/* Additional Info */}
                {plan.savings && (
                  <div className="mt-4 text-center">
                    <p className="text-sm font-medium text-green-600">
                      {plan.savings}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Additional Information */}
        <div className="mx-auto mt-16 max-w-2xl text-center lg:max-w-4xl">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-6 text-sm text-gray-500">
            <div className="flex items-center">
              <svg className="mr-2 h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Cancel anytime
            </div>
            <div className="flex items-center">
              <svg className="mr-2 h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Secure payments
            </div>
            <div className="flex items-center">
              <svg className="mr-2 h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              24/7 support
            </div>
          </div>
          
          {data?.footerText && (
            <p className="mt-6 text-sm leading-6 text-gray-500">
              {data.footerText}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
