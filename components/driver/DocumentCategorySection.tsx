'use client';

import type { ReactNode } from 'react';
import type { GroupedDocumentCategory } from '@/lib/driver/document-categories';

type DocumentCategorySectionProps = {
  category: GroupedDocumentCategory;
  approvedCount: number;
  children: ReactNode;
};

export default function DocumentCategorySection({
  category,
  approvedCount,
  children,
}: DocumentCategorySectionProps) {
  const total = category.documents.length;

  return (
    <section className="scroll-mt-20">
      <div className="mb-5 flex flex-col gap-2 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-blue-950">{category.title}</h2>
          <p className="mt-1 text-sm text-gray-700">{category.examples}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            {category.description}
          </p>
        </div>
        <p className="text-sm font-medium text-gray-500">
          <span className="text-blue-950">{approvedCount}</span> of {total} approved
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}