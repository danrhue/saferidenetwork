import {
  DOCUMENT_CATEGORY_META,
  DOCUMENT_CATEGORY_ORDER,
  type DocumentCategoryId,
  type RequiredDocument,
} from '@/lib/driver/document-catalog';

export type { DocumentCategoryId };

export type DocumentCategory = {
  id: DocumentCategoryId;
  title: string;
  examples: string;
  description: string;
};

/** Static category definitions derived from the catalog metadata. */
export const DOCUMENT_CATEGORIES: DocumentCategory[] = DOCUMENT_CATEGORY_ORDER.map((id) => ({
  id,
  ...DOCUMENT_CATEGORY_META[id],
}));

export type GroupedDocumentCategory = DocumentCategory & {
  documents: RequiredDocument[];
};

/**
 * Group resolved required documents into UI categories using each document's
 * `category` field from the code catalog.
 */
export function groupDocumentsByCategory(
  documents: RequiredDocument[]
): GroupedDocumentCategory[] {
  const byCategory = new Map<DocumentCategoryId, RequiredDocument[]>();

  for (const doc of documents) {
    const categoryId = doc.category ?? 'other';
    const list = byCategory.get(categoryId) ?? [];
    list.push(doc);
    byCategory.set(categoryId, list);
  }

  return DOCUMENT_CATEGORY_ORDER.flatMap((id) => {
    const categoryDocs = byCategory.get(id);
    if (!categoryDocs?.length) return [];

    return [
      {
        id,
        ...DOCUMENT_CATEGORY_META[id],
        documents: categoryDocs,
      },
    ];
  });
}