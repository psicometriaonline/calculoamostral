/**
 * Format a stored phone number for display, recognising the international
 * dialing code (DDI) when the value uses the E.164 format ("+5511999998888").
 *
 * Supports the most common countries used by the platform with country-aware
 * masks; falls back to a sensible generic grouping for other DDIs and treats
 * legacy values without the leading "+" as Brazilian numbers (no DDI).
 *
 * Shared between client and server so that on-screen displays and CSV exports
 * use exactly the same formatting.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (!hasPlus) {
    return formatBrLocal(digits);
  }

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+55 ${formatBrLocal(digits.slice(2))}`;
  }

  if (digits.startsWith('1') && digits.length === 11) {
    const local = digits.slice(1);
    return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }

  if (digits.startsWith('351') && digits.length === 12) {
    const local = digits.slice(3);
    return `+351 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }

  return formatGenericInternational(digits);
}

function formatBrLocal(digits: string): string {
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function formatGenericInternational(digits: string): string {
  const candidates = [2, 1, 3];
  for (const ddiLen of candidates) {
    if (digits.length > ddiLen + 5) {
      const ddi = digits.slice(0, ddiLen);
      const local = digits.slice(ddiLen);
      return `+${ddi} ${groupLocalDigits(local)}`;
    }
  }
  return `+${digits}`;
}

function groupLocalDigits(local: string): string {
  if (local.length <= 4) return local;
  const tail = local.slice(-4);
  const head = local.slice(0, -4);
  const headGroups = head.match(/.{1,3}/g) ?? [];
  return [...headGroups, tail].join(' ');
}
