/**
 * Count lines that contain code. Blank lines and full-line `#` comments do not count.
 */
export function countCodeLines(code: string): number {
  if (code.length === 0) return 0;
  return code.split("\n").filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  }).length;
}

export function exceedsMaxLines(
  code: string,
  maxLines: number | null,
): boolean {
  if (maxLines === null) return false;
  return countCodeLines(code) > maxLines;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word match against forbidden keywords. A keyword inside a string can match.
 */
export function findForbiddenKeywords(
  code: string,
  forbiddenKeywords: readonly string[],
): string[] {
  const found: string[] = [];
  for (const keyword of forbiddenKeywords) {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`);
    if (pattern.test(code)) found.push(keyword);
  }
  return found;
}

export function hasForbiddenKeyword(
  code: string,
  forbiddenKeywords: readonly string[],
): boolean {
  return findForbiddenKeywords(code, forbiddenKeywords).length > 0;
}
