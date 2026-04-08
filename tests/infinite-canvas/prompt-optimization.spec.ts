import { describe, expect, it } from 'vitest';
import {
  buildPromptOptimizationVariantsInput,
  buildPromptOptimizationVariantsSystemPrompt,
  parsePromptOptimizationVariants,
  PROMPT_OPTIMIZATION_SEPARATOR,
  PROMPT_OPTIMIZATION_VARIANT_COUNT,
} from '@/app/infinite-canvas/_lib/prompt-optimization';

describe('infinite canvas prompt optimization helpers', () => {
  it('appends strict multi-result output rules onto the base prompt', () => {
    const result = buildPromptOptimizationVariantsSystemPrompt('原始系统提示');

    expect(result).toContain('原始系统提示');
    expect(result).toContain(`一次性返回 ${PROMPT_OPTIMIZATION_VARIANT_COUNT} 个优化后的中文 prompt`);
    expect(result).toContain(PROMPT_OPTIMIZATION_SEPARATOR);
  });

  it('parses variants separated by the expected delimiter', () => {
    const result = parsePromptOptimizationVariants(
      `结果一 ${PROMPT_OPTIMIZATION_SEPARATOR} 结果二 ${PROMPT_OPTIMIZATION_SEPARATOR} 结果三 ${PROMPT_OPTIMIZATION_SEPARATOR} 结果四`,
    );

    expect(result).toEqual(['结果一', '结果二', '结果三', '结果四']);
  });

  it('strips heading-like result labels from delimiter separated variants', () => {
    const result = parsePromptOptimizationVariants(
      `### 结果一\n结果一 ${PROMPT_OPTIMIZATION_SEPARATOR} ###结果二\n结果二 ${PROMPT_OPTIMIZATION_SEPARATOR} ### 结果3\n结果三 ${PROMPT_OPTIMIZATION_SEPARATOR} ###方案四\n结果四`,
    );

    expect(result).toEqual(['结果一', '结果二', '结果三', '结果四']);
  });

  it('falls back to numbered blocks when the model does not use the delimiter', () => {
    const result = parsePromptOptimizationVariants(`
1. 第一条优化结果
2. 第二条优化结果
3. 第三条优化结果
4. 第四条优化结果
`);

    expect(result).toEqual(['第一条优化结果', '第二条优化结果', '第三条优化结果', '第四条优化结果']);
  });

  it('falls back to heading blocks when the model uses "###结果一" format', () => {
    const result = parsePromptOptimizationVariants(`
###结果一
第一条优化结果

### 结果二：
第二条优化结果

###方案3
第三条优化结果

### 输出四
第四条优化结果
`);

    expect(result).toEqual(['第一条优化结果', '第二条优化结果', '第三条优化结果', '第四条优化结果']);
  });

  it('wraps the selected node text as explicit source input', () => {
    const result = buildPromptOptimizationVariantsInput('黄色 lemo 在海边晒太阳');

    expect(result).toBe('黄色 lemo 在海边晒太阳');
  });
});
