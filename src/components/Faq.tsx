
import React, { useState } from 'react';

interface FAQItem {
  q: string;
  a: string;
}

interface FAQProps {
  data?: {
    items?: FAQItem[];
  } & Record<string, any>;
  className?: string;
}


/** @manually */
export default function Faq({ data, className = "" }: FAQProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleItem(index);
    }
  };

  const faqItems = data?.items || [];

  if (faqItems.length === 0) {
    return null;
  }

  return (
    <section className={`py-24 sm:py-32 ${className}`} aria-labelledby="faq-heading">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center lg:max-w-4xl">
          <h2 id="faq-heading" className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="mx-auto mt-16 max-w-2xl space-y-6 lg:max-w-4xl">
          {faqItems.map((qa: FAQItem, idx: number) => {
            const isOpen = openItems.has(idx);
            return (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <button
                  className="w-full px-6 py-4 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-lg"
                  onClick={() => toggleItem(idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  id={`faq-question-${idx}`}
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 pr-4">
                      {qa.q}
                    </h3>
                    <div
                      className={`flex-shrink-0 w-6 h-6 flex items-center justify-center transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : 'rotate-0'
                      }`}
                      aria-hidden="true"
                    >
                      <svg
                        className="h-4 w-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
                <div
                  id={`faq-answer-${idx}`}
                  role="region"
                  aria-labelledby={`faq-question-${idx}`}
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-4">
                    <p className="text-base leading-7 text-gray-600">
                      {qa.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
