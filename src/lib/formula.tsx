const SUB = "₀₁₂₃₄₅₆₇₈₉";

/** "C16H19N3O5S" with Unicode subscript digits, read aloud as "C 16 H 19 N 3 O 5 S". */
export function Formula({ value }: { value: string }) {
  const shown = value.replace(/\d/g, (d) => SUB[Number(d)]);
  const spoken = value.replace(/([A-Z][a-z]?)(\d*)/g, (_, el, n) => `${el}${n ? ` ${n}` : ""} `).trim();
  return (
    <span role="img" aria-label={spoken}>
      {shown}
    </span>
  );
}

export const toSubscript = (s: string) => s.replace(/\d/g, (d) => SUB[Number(d)]);
