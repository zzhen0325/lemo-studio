function stripCodeFence(text: string): string {
  const value = text.trim();
  if (!value.startsWith('```') || !value.endsWith('```')) {
    return value;
  }
  return value.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '').trim();
}

export function sanitizeCozePromptTemplateText(raw: string): string {
  const stripped = stripCodeFence(raw).trim();
  if (!stripped) {
    return '';
  }

  const firstSegment = stripped
    .split('|||')
    .map((segment) => segment.trim())
    .find(Boolean) || '';
  const withoutQuotes = firstSegment.replace(/^['"]+|['"]+$/g, '').trim();
  const compacted = withoutQuotes
    .replace(/^\s*(?:[-*]\s+|\d+[.)]\s+)/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return compacted;
}

export function extractCozePromptTemplate(payload: unknown): string {
  const preferredKeys = [
    'expanded_prompt',
    'text',
    'output_text',
    'output',
    'result',
    'answer',
    'content',
    'message',
    'response',
    'data',
  ];

  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();
  let fallbackUrl = '';

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined) {
      continue;
    }

    if (typeof current === 'string') {
      const value = sanitizeCozePromptTemplateText(current);
      if (!value) {
        continue;
      }

      if (/^https?:\/\//i.test(value) && !fallbackUrl) {
        fallbackUrl = value;
        continue;
      }

      return value;
    }

    if (typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === 'string' || typeof value === 'object') {
        queue.unshift(value);
      }
    }

    for (const value of Object.values(record)) {
      if (typeof value === 'string' || typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return sanitizeCozePromptTemplateText(fallbackUrl);
}

export function buildMoodboardPromptTemplateInstruction(params: {
  moodboardName?: string;
  currentTemplate?: string;
}): string {
  const lines: string[] = [
    '你是专业的视觉提示词写作助手。',
    '请根据输入图片内容，生成一段可直接用于 Prompt Template 的中文描述。',
    '输出要求：',
    '1. 只输出一段 Prompt Template，不要标题、解释、编号、Markdown、代码块。',
    '2. 不要输出分隔符（例如 |||）。',
    '3. 内容要覆盖主体、场景、构图、光线、材质、色彩氛围和可见文字等关键信息。',
    '4. 保持语句通顺，可直接复制使用。',
  ];

  const moodboardName = params.moodboardName?.trim();
  if (moodboardName) {
    lines.push(`当前 moodboard 名称：${moodboardName}`);
  }

  const currentTemplate = params.currentTemplate?.trim();
  if (currentTemplate) {
    lines.push('下面是当前模板，可参考其表达方向，但请基于图片重写为更准确的新模板：');
    lines.push(currentTemplate);
  }

  return lines.join('\n');
}
