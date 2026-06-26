export type WizardProfileInput = Record<string, unknown>;

export function normalizeSsn(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidSsn(ssn: string): boolean {
  if (!/^\d{9}$/.test(ssn)) return false;
  if (ssn === '000000000') return false;
  if (ssn.startsWith('000') || ssn.startsWith('666') || ssn.startsWith('9')) return false;
  return true;
}

export function validateDateOfBirth(
  month: unknown,
  day: unknown,
  year: unknown
): string | null {
  const monthNum = typeof month === 'number' ? month : parseInt(String(month ?? ''), 10);
  const dayNum = typeof day === 'number' ? day : parseInt(String(day ?? ''), 10);
  const yearNum = typeof year === 'number' ? year : parseInt(String(year ?? ''), 10);

  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return 'Select a valid birth month.';
  }
  if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) {
    return 'Select a valid birth day.';
  }
  if (!Number.isFinite(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear()) {
    return 'Select a valid birth year.';
  }

  const date = new Date(yearNum, monthNum - 1, dayNum);
  if (
    date.getFullYear() !== yearNum ||
    date.getMonth() !== monthNum - 1 ||
    date.getDate() !== dayNum
  ) {
    return 'Select a valid date of birth.';
  }

  const today = new Date();
  let age = today.getFullYear() - yearNum;
  const hadBirthday =
    today.getMonth() > monthNum - 1 ||
    (today.getMonth() === monthNum - 1 && today.getDate() >= dayNum);
  if (!hadBirthday) age -= 1;

  if (age < 18) {
    return 'You must be at least 18 years old to drive with Safe Ride Network.';
  }

  return null;
}

export function validatePersonalDetailsStep(
  profile: WizardProfileInput,
  ssnVerify: string
): Record<string, string> {
  const errors: Record<string, string> = {};

  const dobError = validateDateOfBirth(profile.dob_month, profile.dob_day, profile.dob_year);
  if (dobError) {
    errors.dob = dobError;
  }

  const ssn = normalizeSsn(profile.ssn);
  if (!ssn) {
    errors.ssn = 'Social Security Number is required.';
  } else if (!isValidSsn(ssn)) {
    errors.ssn = 'Enter a valid 9-digit Social Security Number.';
  }

  const verify = normalizeSsn(ssnVerify);
  if (!verify) {
    errors.ssn_verify = 'Please re-enter your Social Security Number to verify.';
  } else if (ssn && verify !== ssn) {
    errors.ssn_verify = 'Social Security Numbers do not match.';
  }

  if (!String(profile.hair_color ?? '').trim()) {
    errors.hair_color = 'Select your hair color.';
  }
  if (!String(profile.eye_color ?? '').trim()) {
    errors.eye_color = 'Select your eye color.';
  }
  if (profile.height_feet == null || profile.height_feet === '') {
    errors.height_feet = 'Select your height (feet).';
  }
  if (profile.height_inches == null || profile.height_inches === '') {
    errors.height_inches = 'Select your height (inches).';
  }
  if (profile.weight_lbs == null || profile.weight_lbs === '') {
    errors.weight_lbs = 'Enter your weight in pounds.';
  } else {
    const weight = Number(profile.weight_lbs);
    if (!Number.isFinite(weight) || weight < 50 || weight > 500) {
      errors.weight_lbs = 'Enter a realistic weight between 50 and 500 lbs.';
    }
  }
  if (!String(profile.gender ?? '').trim()) {
    errors.gender = 'Select your gender.';
  }

  return errors;
}