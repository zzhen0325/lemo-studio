export const PROMPT_OPTIMIZATION_VARIANT_COUNT = 4;
export const PROMPT_OPTIMIZATION_SEPARATOR = '|||';

function cleanupPromptVariant(value: string) {
  return value
    .trim()
    .replace(/^[\s"'“”`]+|[\s"'“”`]+$/g, '')
    .replace(/^\d+\s*[\.\)、]\s*/, '')
    .replace(/^[-*]\s*/, '')
    .trim();
}

function splitNumberedVariants(text: string) {
  const matches = Array.from(
    text.matchAll(/(?:^|\n)\s*(?:\d+\s*[\.\)、]|[-*])\s*([\s\S]*?)(?=(?:\n\s*(?:\d+\s*[\.\)、]|[-*])\s)|$)/g),
  );

  return matches
    .map((match) => cleanupPromptVariant(match[1] || ''))
    .filter(Boolean);
}

export function buildPromptOptimizationVariantsSystemPrompt(
  basePrompt?: string,
  resultCount = PROMPT_OPTIMIZATION_VARIANT_COUNT,
) {
  const instructions = [
    '## 本次输出要求',
    `1. 一次性返回 ${resultCount} 个优化后的中文 prompt。`,
    '2. 每个结果都必须是完整、可直接用于图像生成的内容，且优化方向要有差异。',
    `3. 每个结果之间必须使用 "${PROMPT_OPTIMIZATION_SEPARATOR}" 作为唯一分隔符。`,
    `4. 除了 ${resultCount} 个 prompt 和分隔符外，不要输出编号、标题、解释、引号、Markdown。`,
  ].join('\n');

  const trimmedBasePrompt = basePrompt?.trim();
  return trimmedBasePrompt ? `${trimmedBasePrompt}\n\n${instructions}` : instructions;
}

export function buildPromptOptimizationVariantsInput(
  text: string,
  resultCount = PROMPT_OPTIMIZATION_VARIANT_COUNT,
) {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  return [
    '请严格基于下面这段用户原始内容进行优化，不要脱离原意，不要替换主题，只能做表达、细节、构图和风格层面的增强。',
    `请输出 ${resultCount} 个不同方向但都忠于原始内容的结果。`,
    '<用户原始内容>',
    trimmed,
    '</用户原始内容>',
  ].join('\n');
}

export function parsePromptOptimizationVariants(
  text: string,
  resultCount = PROMPT_OPTIMIZATION_VARIANT_COUNT,
) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const separated = trimmed.includes(PROMPT_OPTIMIZATION_SEPARATOR)
    ? trimmed.split(PROMPT_OPTIMIZATION_SEPARATOR)
    : [];
  const normalizedSeparated = separated
    .map((item) => cleanupPromptVariant(item))
    .filter(Boolean);
  if (normalizedSeparated.length > 0) {
    return normalizedSeparated.slice(0, resultCount);
  }

  const numbered = splitNumberedVariants(trimmed);
  if (numbered.length > 0) {
    return numbered.slice(0, resultCount);
  }

  const paragraphSplit = trimmed
    .split(/\n{2,}/)
    .map((item) => cleanupPromptVariant(item))
    .filter(Boolean);
  if (paragraphSplit.length > 1) {
    return paragraphSplit.slice(0, resultCount);
  }

  const single = cleanupPromptVariant(trimmed);
  return single ? [single] : [];
}
