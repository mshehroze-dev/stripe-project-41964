import React, { FC } from "react";
import { Link } from "react-router-dom";
const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8" style={{ backgroundColor: 'var(--c-bg-dark)', color: 'var(--c-fg-light)' }}>
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg leading-relaxed" style={{ backgroundColor: 'var(--c-surface)', borderRadius: 'var(--radius)' }}>
          <p className="mb-4" style={{ color: 'var(--c-fg-light)' }}>Effective Date: October 26, 2023</p>
          <p className="mb-4" style={{ color: 'var(--c-fg-muted)' }}>
            Welcome to SaaS Boilerplate! These Terms of Service ("Terms") govern your use of our website and services (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms and our Privacy Policy.
          </p>
          <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--c-primary)' }}>1. Acceptance of Terms</h2>
          <p className="mb-4" style={{ color: 'var(--c-fg-muted)' }}>
            By accessing or using the Service, you confirm that you have read, understood, and agree to be bound by these Terms, including any future modifications. If you do not agree to these Terms, you may not use the Service.
          </p>
          <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--c-primary)' }}>2. Changes to Terms</h2>
          <p className="mb-4" style={{ color: 'var(--c-fg-muted)' }}>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.'
          </p>
          <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--c-primary)' }}>3. Privacy Policy</h2>
          <p className="mb-4" style={{ color: 'var(--c-fg-muted)' }}>
            Your access to and use of the Service is also conditioned on Your acceptance of and compliance with Our Privacy Policy. Our Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your personal information when You use the Application or the Website and tells You about Your privacy rights and how the law protects You. Please read Our Privacy Policy carefully before using Our Service.
          </p>
          <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--c-primary)' }}>4. User Accounts</h2>
          <p className="mb-4" style={{ color: 'var(--c-fg-muted)' }}>
            When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
          </p>
          <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--c-primary)' }}>5. Subscriptions and Payments</h2>
          <p className="mb-4" style={{ color: 'var(--c-fg-muted)' }}>
            Certain parts of the Service are billed on a subscription basis ("Subscription(s)"). You will be billed in advance on a recurring and periodic basis ("Billing Cycle"). At the end of each Billing Cycle, your Subscription will automatically renew under the exact same conditions unless you cancel it or SaaS Boilerplate Inc. cancels it.
          </p>
          <div className="mt-8 text-center">
            <Link
              to="/"
              className="text-gray-400 hover:text-gray-200 transition-colors duration-200"
              style={{ color: 'var(--c-fg-muted)' }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Terms;