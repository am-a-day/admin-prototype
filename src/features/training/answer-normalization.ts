export function normalizeTrainingAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,!?;:()[\]{}"«»“”'`]+/g, " ")
    .replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

export function isAcceptedTrainingAnswer(input: string, acceptedAnswers: string[]) {
  const normalizedInput = normalizeTrainingAnswer(input);
  if (!normalizedInput) return false;

  return acceptedAnswers.some((answer) => {
    const normalizedAnswer = normalizeTrainingAnswer(answer);
    if (!normalizedAnswer) return false;
    if (normalizedInput === normalizedAnswer) return true;

    const minLength = Math.min(normalizedInput.length, normalizedAnswer.length);
    if (minLength < 8) return false;
    if (Math.abs(normalizedInput.length - normalizedAnswer.length) > 1) return false;

    return levenshteinDistance(normalizedInput, normalizedAnswer) <= 1;
  });
}
