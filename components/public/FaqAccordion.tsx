'use client';

import { useState } from 'react';

export type FaqItem = {
  question: string;
  answer: string;
};

type FaqAccordionProps = {
  items: FaqItem[];
  className?: string;
};

export default function FaqAccordion({ items, className = '' }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;

        return (
          <div
            key={item.question}
            className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
          >
            <button
              id={buttonId}
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] focus-visible:ring-inset"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span className="text-base font-semibold text-blue-950">{item.question}</span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1E3A8A] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className={`border-t border-blue-50 px-5 text-blue-900 ${isOpen ? 'block pb-5 pt-3' : 'hidden'}`}
            >
              <p className="leading-relaxed">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}