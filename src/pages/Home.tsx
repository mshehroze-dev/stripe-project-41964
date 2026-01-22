import React from 'react';
import { Link } from 'react-router-dom';import { NuvraBadge } from '@/components/NuvraBadge';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Pricing from '@/components/Pricing';
import Faq from '@/components/Faq';
import ContactUs from '@/components/ContactUs';
import CallToAction from '@/components/CallToAction';

const Home: React.FC = () => {  const user = null;
  const componentRegistry: Record<string, React.ComponentType<any>> = {
    "CallToAction": CallToAction  };


  // ==========================================
  // DEFAULT LAYOUT (ALWAYS RENDERED)
  // ==========================================

  // Sample data for components
  const heroData = {
    headline: 'Welcome to Stripe project',
    sub: 'A modern full-stack application built with React, Vite, Tailwind CSS, and Supabase. Get started by signing up or exploring the features below.'
  }

  const starterCheckoutLink ='/checkout?plan=starter';
  const proCheckoutLink ='/checkout?plan=professional';
  const signupLink ='/';

  const featuresData = {
    // Uses default features from Features component
  }

  const pricingData = {
    title: 'Choose Your Plan',
    subtitle: 'Select the perfect plan for your needs. Upgrade or downgrade at any time.',
    plans: [
      {
        name: 'Starter',
        price: '$9',
        interval: 'month',
        description: 'Perfect for getting started',
        features: [
          'Up to 5 projects',
          'Basic authentication',
          'Community support',
          '1GB storage'
        ],
        cta: user ? 'Subscribe' : 'Get Started',
        ctaLink: user ? starterCheckoutLink : signupLink,
        stripeLookupKey: 'starter_monthly'
      },
      {
        name: 'Professional',
        price: '$29',
        interval: 'month',
        description: 'Best for growing businesses',
        popular: true,
        features: [
          'Unlimited projects',
          'Advanced authentication',
          'Priority support',
          '10GB storage',
          'Custom domains',
          'Analytics dashboard'
        ],
        cta: user ? 'Subscribe' : 'Start Free Trial',
        ctaLink: user ? proCheckoutLink : signupLink,
        stripeLookupKey: 'pro_monthly',
        trial: user ? undefined : '14-day free trial'
      },
      {
        name: 'Enterprise',
        price: '$99',
        interval: 'month',
        description: 'For large-scale applications',
        features: [
          'Everything in Professional',
          'Dedicated support',
          'Custom integrations',
          '100GB storage',
          'Advanced security',
          'SLA guarantee'
        ],
        cta: 'Contact Sales',
        ctaLink: '/contact'
      }
    ]
  }

  const faqData = {
    items: [
      {
        q: 'What technologies are included in this template?',
        a: 'This template includes React 18, TypeScript, Vite, Tailwind CSS, Supabase for authentication and database, and serverless edge functions for backend functionality.'
      },
      {
        q: 'How do I get started with development?',
        a: 'Clone the repository, install dependencies with npm install, configure your Supabase credentials in the .env file, and run npm run dev to start the development server.'
      },
      {
        q: 'Is authentication included?',
        a: 'Yes, the template includes a complete authentication system powered by Supabase Auth with email/password login, user registration, and protected routes.'
      },
      {
        q: 'Can I customize the design?',
        a: 'Absolutely! The template uses Tailwind CSS for styling, making it easy to customize colors, spacing, and layout. All components are designed to be easily modified.'
      },
      {
        q: 'What kind of support is available?',
        a: 'The template includes comprehensive documentation, example code, and community support. Professional plans include priority support and custom assistance.'
      }
    ]
  }

  const defaultSections = (
    <>      <ContactUs />
      <section className="bg-indigo-50">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:flex lg:items-center lg:justify-between lg:px-8">
          <div className="lg:w-0 lg:flex-1">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Join thousands of developers who are building amazing applications with our modern stack.
            </p>
          </div>
          <div className="mt-10 flex items-center gap-x-6 lg:mt-0 lg:flex-shrink-0">            <Link
              to="/"
              className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors duration-200"
            >
              Explore Features
            </Link>          </div>
        </div>
      </section>
    </>
  );

  return (
    <div className="min-h-screen bg-white">
          <Hero data={ {"cta_text": "", "headline": "Build Your SaaS Faster with Our Boilerplate", "image_url": null, "sub": "Everything you need to launch your next big idea, from authentication to payments.", "type": "hero"} } className="section-hero" />
          <Features data={ {"items": [{"desc": "", "title": ""}, {"desc": "", "title": ""}, {"desc": "", "title": ""}, {"desc": "", "title": ""}, {"desc": "", "title": ""}, {"desc": "", "title": ""}], "type": "features"} } className="section-features" />
          <Pricing data={ {"description": "Choose the plan that\u0027s right for your business.", "id": "pricing", "plans": [{"cta": "Get started", "ctaLabel": "Start Free Trial", "ctaTo": "/signup", "features": ["5 Users", "1GB Storage", "Basic Analytics", "Email Support"], "frequency": "month", "highlight": false, "name": "Starter", "price": "$19"}, {"cta": "Get started", "ctaLabel": "Choose Pro", "ctaTo": "/checkout/pro", "features": ["25 Users", "10GB Storage", "Advanced Analytics", "Priority Support", "Custom Integrations"], "frequency": "month", "highlight": false, "isPopular": true, "name": "Pro", "price": "$49"}, {"cta": "Get started", "ctaLabel": "Contact Sales", "ctaTo": "/contact", "features": ["Unlimited Users", "Unlimited Storage", "Dedicated Support", "SLA Guaranteed", "On-premise Options"], "frequency": "month", "highlight": false, "name": "Enterprise", "price": "Custom"}], "subtitle": "", "title": "Simple \u0026 Transparent Pricing", "type": "pricing"} } className="section-pricing" />
          <Faq data={ {"items": [], "title": "Frequently Asked Questions", "type": "faq"} } className="section-faq" />
           {/* Custom Component: CallToAction - dynamically rendered */}
           <section className="section-custom py-12">
             <div className="mx-auto max-w-6xl px-6">
               {(() => {
                 const Component = componentRegistry["CallToAction"];
                 if (Component) {
                   return (
                    <div className={"replica-section section-calltoaction"} style={ { width: "100%" } }>
                      <Component
                        {...{"ctaLabel": "Get Started Today", "ctaTo": "/signup", "description": "Join thousands of developers building faster with our comprehensive starter kit.", "title": "Ready to launch your SaaS?"} }
                        className="replica-section section-calltoaction"
                      />
                    </div>
                    );
                 }
                 return (
                   <div className="card rounded-2xl border p-8">
                     <h3 className="text-xl font-semibold">
                       CallToAction (component not found)
                     </h3>
                     <p className="mt-3">
                       { "" }
                     </p>
                   </div>
                 );
               })()}
             </div>
           </section>

      {defaultSections}

      <NuvraBadge />
    </div>
  )
}

export default Home;
