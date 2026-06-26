import type { SupabaseClient, User } from '@supabase/supabase-js';
import { resolveRequiredDocumentsForStates } from '@/lib/driver/resolve-driver-documents';
import type { StateRequirementRow } from '@/lib/driver/resolve-driver-documents';
import { normalizeStateCodes } from '@/lib/driver/us-states';

export async function fetchDrivingStatesForUser(
  admin: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('driving_states')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeStateCodes(data?.driving_states);
}

export async function countRequiredDocumentsForStates(
  admin: SupabaseClient,
  drivingStates: string[]
): Promise<number> {
  const states = normalizeStateCodes(drivingStates);
  if (states.length === 0) return 0;

  const { data: rows, error } = await admin
    .from('state_document_requirements')
    .select('state_code, document_type, sort_order, is_required')
    .in('state_code', states)
    .eq('is_required', true);

  if (error) {
    throw new Error(error.message);
  }

  return resolveRequiredDocumentsForStates(states, (rows ?? []) as StateRequirementRow[]).length;
}

export async function saveDrivingStatesForUser(
  admin: SupabaseClient,
  user: User,
  rawStates: string[]
): Promise<{ drivingStates: string[]; requiredDocumentCount: number }> {
  const drivingStates = normalizeStateCodes(rawStates);

  if (drivingStates.length === 0) {
    throw new Error('Select at least one state where you plan to drive.');
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (profile?.role === 'organization') {
    throw new Error('Only driver accounts can set operating states.');
  }

  const fullName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    user.email ||
    'Driver';

  const { error: upsertError } = await admin.from('profiles').upsert(
    {
      id: user.id,
      role: profile?.role ?? 'driver',
      full_name: fullName,
      driving_states: drivingStates,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: false }
  );

  if (upsertError) {
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        driving_states: drivingStates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  const requiredDocumentCount = await countRequiredDocumentsForStates(admin, drivingStates);

  return { drivingStates, requiredDocumentCount };
}