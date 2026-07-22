/**
 * Un numéro mobile français commence par 06 ou 07 (format national), ou
 * +33 6 / +33 7 (format international). On retire tout sauf les chiffres avant
 * de tester, pour absorber les espaces/points de mise en forme de Google.
 */
export function isMobilePhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return /^0[67]/.test(digits) || /^33[67]/.test(digits);
}
