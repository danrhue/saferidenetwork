/** Greeting name for the driver overview — prefers saved profile first name. */
export function getDriverGreetingName(
  profile: Record<string, unknown>,
  authFullName?: string | null
): string {
  const fromProfile =
    typeof profile.first_name === 'string' ? profile.first_name.trim() : '';
  if (fromProfile) return fromProfile;

  const fromAuth = authFullName?.trim().split(/\s+/)[0];
  if (fromAuth) return fromAuth;

  return 'Driver';
}