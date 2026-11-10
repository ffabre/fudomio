type NumberParts = {
  decimal: string;
  group: string | null;
};

function numberParts(locale: string): NumberParts {
  const format = (value: number) =>
    new Intl.NumberFormat(locale, { useGrouping: true }).formatToParts(value);
  const decimal =
    format(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  const group = format(1000).find((part) => part.type === "group")?.value;
  return {
    decimal,
    group: group && group !== decimal ? group : null,
  };
}

export function formatPrice(cents: number, locale: string): string {
  const negative = cents < 0;
  const absolute = Math.abs(Math.trunc(cents));
  const whole = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  const { decimal } = numberParts(locale);
  const wholeText = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(whole);

  return `${negative ? "-" : ""}${wholeText}${decimal}${fraction}`;
}

export function parsePrice(input: string, locale: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const { decimal, group } = numberParts(locale);
  const body = group ? trimmed.split(group).join("") : trimmed;
  if (body.includes("-") || body.includes("+")) return null;

  const pieces = body.split(decimal);
  if (pieces.length > 2) return null;

  const whole = pieces[0] ?? "";
  const fraction = pieces[1] ?? "";
  if (fraction.length > 2) return null;
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) return null;
  if (whole === "" && fraction === "") return null;

  const wholeValue = whole === "" ? 0 : Number(whole);
  const fractionValue = Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(wholeValue) || !Number.isSafeInteger(fractionValue)) {
    return null;
  }

  const cents = wholeValue * 100 + fractionValue;
  return Number.isSafeInteger(cents) ? cents : null;
}
