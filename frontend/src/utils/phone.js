/*
 * Philippine mobile number helpers (09XXXXXXXXX, 11 digits).
 *
 * - cleanPhoneInput: for onChange — digits only, max 11 chars.
 * - normalizePhMobile: for onBlur — auto-adds the 09 prefix
 *   (handles 9XXXXXXXXX, 63XXXXXXXXXX, 09XXXXXXXXX).
 * - cleanPhoneOrEmail / normalizePhoneOrEmail: same, but leaves
 *   email-like values (phone-or-email fields) untouched.
 */

export function cleanPhoneInput(v) {
  return String(v ?? '').replace(/\D/g, '').slice(0, 11);
}

/*
 * Live typing formatter: digits only, max 11, and the box always
 * shows the 09 prefix as soon as the first digit is typed.
 * Typing "9" becomes "09", "9123456789" becomes "09123456789".
 */
export function formatPhoneLive(v) {
  let d = String(v ?? '').replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d === '0') return '09';
  d = d.replace(/^0+/, '');
  if (d.startsWith('63')) d = d.slice(2);
  if (!d) return '09';
  if (d.startsWith('9')) d = '0' + d;
  else if (!d.startsWith('09')) d = '09' + d;
  return d.slice(0, 11);
}

export function normalizePhMobile(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (!d) return '';
  d = d.replace(/^0+/, '');
  if (d.startsWith('63')) d = d.slice(2);
  if (!d) return '';
  if (d.startsWith('9')) d = '0' + d;
  else if (!d.startsWith('09')) d = '09' + d;
  return d.slice(0, 11);
}

export function isPhoneLike(v) {
  return !/[@a-zA-Z]/.test(String(v ?? ''));
}

export function cleanPhoneOrEmail(v) {
  if (!isPhoneLike(v)) return String(v ?? '');
  return cleanPhoneInput(v);
}

export function formatPhoneOrEmailLive(v) {
  if (!isPhoneLike(v)) return String(v ?? '');
  return formatPhoneLive(v);
}

export function normalizePhoneOrEmail(v) {
  if (!isPhoneLike(v)) return String(v ?? '');
  return normalizePhMobile(v);
}

export function isValidPhMobile(v) {
  return /^09\d{9}$/.test(String(v ?? '').trim());
}
