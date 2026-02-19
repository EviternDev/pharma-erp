const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const tens = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigitWords(n: number): string {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o ? " " + ones[o] : "");
}

function threeDigitWords(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let result = "";
  if (h > 0) result = ones[h] + " Hundred";
  if (rest > 0) result += (result ? " " : "") + twoDigitWords(rest);
  return result;
}

/**
 * Convert paise amount to Indian words format.
 * e.g. 14850 → "One Hundred Forty-Eight Rupees and Fifty Paise Only"
 *
 * Uses the Indian numbering system: Crore, Lakh, Thousand, Hundred.
 */
export function paiseToWords(paise: number): string {
  if (paise === 0) return "Zero Rupees Only";

  const rupees = Math.floor(paise / 100);
  const paiseRemainder = paise % 100;

  let rupeeWords = "";

  if (rupees > 0) {
    const parts: string[] = [];

    // Crores (1,00,00,000)
    const crores = Math.floor(rupees / 10000000);
    if (crores > 0) parts.push(twoDigitWords(crores) + " Crore");

    // Lakhs (1,00,000)
    const lakhs = Math.floor((rupees % 10000000) / 100000);
    if (lakhs > 0) parts.push(twoDigitWords(lakhs) + " Lakh");

    // Thousands (1,000)
    const thousands = Math.floor((rupees % 100000) / 1000);
    if (thousands > 0) parts.push(twoDigitWords(thousands) + " Thousand");

    // Hundreds + remainder
    const remainder = rupees % 1000;
    if (remainder > 0) parts.push(threeDigitWords(remainder));

    rupeeWords = parts.join(" ") + " Rupee" + (rupees !== 1 ? "s" : "");
  }

  let paiseWords = "";
  if (paiseRemainder > 0) {
    paiseWords = twoDigitWords(paiseRemainder) + " Paise";
  }

  if (rupeeWords && paiseWords) {
    return rupeeWords + " and " + paiseWords + " Only";
  }
  if (rupeeWords) {
    return rupeeWords + " Only";
  }
  return paiseWords + " Only";
}
