/** Client helper — refetch required documents after operating states change. */
export async function refreshRequiredDocumentsClient(): Promise<{
  drivingStates: string[];
  documentCount: number;
}> {
  const res = await fetch('/api/driver/required-documents', { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Failed to refresh required documents.');
  }

  return {
    drivingStates: Array.isArray(data.drivingStates) ? data.drivingStates : [],
    documentCount: Array.isArray(data.documents) ? data.documents.length : 0,
  };
}