import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format phone number to (XX) X-XXXX-XXXX as user types
 * Accepts up to 11 digits (DDD + 9 digits)
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Limit to 11 digits
  const limited = digits.slice(0, 11);
  
  if (limited.length <= 2) {
    return limited.length > 0 ? `(${limited}` : '';
  }
  if (limited.length <= 3) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  }
  if (limited.length <= 7) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 3)}-${limited.slice(3)}`;
  }
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
}

/**
 * Remove formatting from phone - returns only digits
 */
export function unformatPhone(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

export { formatPhoneDisplay } from "@shared/phone";

/**
 * Format CPF: XXX.XXX.XXX-XX (11 digits)
 * Format CNPJ: XX.XXX.XXX/XXXX-XX (14 digits)
 * Auto-detects based on number of digits
 */
export function formatCpfCnpj(value: string | null | undefined): string {
  if (!value) return '';
  
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Limit to 14 digits (CNPJ max)
  const limited = digits.slice(0, 14);
  
  if (limited.length <= 11) {
    // CPF format: XXX.XXX.XXX-XX
    if (limited.length <= 3) {
      return limited;
    }
    if (limited.length <= 6) {
      return `${limited.slice(0, 3)}.${limited.slice(3)}`;
    }
    if (limited.length <= 9) {
      return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
    }
    return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`;
  } else {
    // CNPJ format: XX.XXX.XXX/XXXX-XX
    if (limited.length <= 2) {
      return limited;
    }
    if (limited.length <= 5) {
      return `${limited.slice(0, 2)}.${limited.slice(2)}`;
    }
    if (limited.length <= 8) {
      return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
    }
    if (limited.length <= 12) {
      return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;
    }
    return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12)}`;
  }
}

/**
 * Remove formatting from CPF/CNPJ - returns only digits
 */
export function unformatCpfCnpj(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

export function validateCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  let remainder = sum % 11;
  const firstVerifier = remainder < 2 ? 0 : 11 - remainder;
  if (digits[9] !== firstVerifier) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  remainder = sum % 11;
  const secondVerifier = remainder < 2 ? 0 : 11 - remainder;
  if (digits[10] !== secondVerifier) return false;

  return true;
}

export function validateCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = cnpj.split('').map(Number);
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * firstWeights[i];
  }
  let remainder = sum % 11;
  const firstVerifier = remainder < 2 ? 0 : 11 - remainder;
  if (digits[12] !== firstVerifier) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += digits[i] * secondWeights[i];
  }
  remainder = sum % 11;
  const secondVerifier = remainder < 2 ? 0 : 11 - remainder;
  if (digits[13] !== secondVerifier) return false;

  return true;
}

export function validateCpfCnpj(value: string): { valid: boolean; message: string } {
  const digits = value.replace(/\D/g, '');

  if (digits.length !== 11 && digits.length !== 14) {
    return { valid: false, message: "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos" };
  }

  if (digits.length === 11) {
    return validateCpf(digits)
      ? { valid: true, message: "" }
      : { valid: false, message: "CPF inválido" };
  }

  return validateCnpj(digits)
    ? { valid: true, message: "" }
    : { valid: false, message: "CNPJ inválido" };
}
