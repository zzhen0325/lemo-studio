'use client';

/**
 * 自包含的轻量日历组件（按月翻页、单选/区间选）。
 * - 不依赖 date-fns / react-day-picker 等第三方库。
 * - 所有日期按本地时区解析，避免 UTC 跨天。
 * - 由父组件受控：`value` / `onChange`。
 *
 * 用法：
 *   <Calendar value={...} onChange={...} />
 *   <Calendar mode="range" value={range} onChange={setRange} />
 */

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CalendarMode = 'single' | 'range';

export interface CalendarSingleValue {
  /** YYYY-MM-DD */
  date?: string;
}

export interface CalendarRangeValue {
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
}

interface CalendarBaseProps {
  mode?: CalendarMode;
  /** 显示的初始月份，缺省使用当前本地月份 */
  initialMonth?: Date;
  /** 不可选的日期，YYYY-MM-DD 列表 */
  disabledDates?: string[];
  /** 不可选的日期 predicate */
  isDateDisabled?: (date: Date) => boolean;
  className?: string;
}

type CalendarProps =
  | (CalendarBaseProps & { mode?: 'single'; value: CalendarSingleValue; onChange: (value: CalendarSingleValue) => void })
  | (CalendarBaseProps & { mode: 'range'; value: CalendarRangeValue; onChange: (value: CalendarRangeValue) => void });

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, monthIndex, day);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isInRange(date: Date, from: Date, to: Date): boolean {
  const time = date.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function buildMonthMatrix(viewMonth: Date): Array<{ date: Date; inMonth: boolean }> {
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  // Monday-first weekday index (0..6)
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstWeekday);

  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({
      date,
      inMonth: date.getMonth() === viewMonth.getMonth(),
    });
  }
  return cells;
}

function formatMonthTitle(date: Date): string {
  return `${date.getFullYear()} 年 ${pad2(date.getMonth() + 1)} 月`;
}

export function Calendar(props: CalendarProps): ReactNode {
  const {
    mode = 'single',
    initialMonth,
    disabledDates,
    isDateDisabled,
    className,
  } = props;

  const disabledSet = useMemo(() => new Set(disabledDates ?? []), [disabledDates]);

  const initialAnchor = useMemo(() => {
    if (mode === 'range') {
      const rangeValue = props.value as CalendarRangeValue;
      return parseDateKey(rangeValue.from) ?? parseDateKey(rangeValue.to) ?? initialMonth ?? new Date();
    }
    const singleValue = props.value as CalendarSingleValue;
    return parseDateKey(singleValue.date) ?? initialMonth ?? new Date();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [viewMonth, setViewMonth] = useState(() => {
    return new Date(initialAnchor.getFullYear(), initialAnchor.getMonth(), 1);
  });

  const goPrev = () => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };
  const goNext = () => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };
  const goToday = () => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    if (mode === 'single') {
      (props.onChange as (v: CalendarSingleValue) => void)({ date: toDateKey(now) });
    }
  };

  const cells = useMemo(() => buildMonthMatrix(viewMonth), [viewMonth]);

  const handleClick = (date: Date) => {
    if (isDateDisabled?.(date)) return;
    if (disabledSet.has(toDateKey(date))) return;
    const key = toDateKey(date);
    if (mode === 'single') {
      (props.onChange as (v: CalendarSingleValue) => void)({ date: key });
      return;
    }
    const range = props.value as CalendarRangeValue;
    // 没有 from 或已闭合 -> 重置
    if (!range.from || (range.from && range.to)) {
      (props.onChange as (v: CalendarRangeValue) => void)({ from: key, to: undefined });
      return;
    }
    // 只有 from，闭合 to
    const fromDate = parseDateKey(range.from);
    if (!fromDate) {
      (props.onChange as (v: CalendarRangeValue) => void)({ from: key, to: undefined });
      return;
    }
    if (date.getTime() < fromDate.getTime()) {
      // 选了比 from 更早的日期 -> 把它当作新的 from
      (props.onChange as (v: CalendarRangeValue) => void)({ from: key, to: range.from });
      return;
    }
    (props.onChange as (v: CalendarRangeValue) => void)({ from: range.from, to: key });
  };

  return (
    <div className={cn('flex w-full flex-col gap-2 text-white/80 select-none', className)}>
      <div className="flex items-center justify-between px-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goPrev}
          className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="上一月"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{formatMonthTitle(viewMonth)}</span>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-2 py-0.5 text-[11px] text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            今天
          </button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goNext}
          className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="下一月"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 px-1 text-center text-[11px] text-white/40">
        {WEEKDAY_LABELS.map((label) => (
          <div key={`weekday-${label}`} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-1">
        {cells.map(({ date, inMonth }) => {
          const key = toDateKey(date);
          const isDisabled = isDateDisabled?.(date) || disabledSet.has(key);
          const today = isSameDay(date, new Date());
          let selected = false;
          let inSelectedRange = false;
          let isRangeStart = false;
          let isRangeEnd = false;
          if (mode === 'single') {
            selected = (props.value as CalendarSingleValue).date === key;
          } else {
            const range = props.value as CalendarRangeValue;
            const fromDate = parseDateKey(range.from);
            const toDate = parseDateKey(range.to);
            if (fromDate && isSameDay(date, fromDate)) {
              selected = true;
              isRangeStart = true;
            }
            if (toDate && isSameDay(date, toDate)) {
              selected = true;
              isRangeEnd = true;
            }
            if (!isRangeStart && !isRangeEnd && fromDate && toDate && isInRange(date, fromDate, toDate)) {
              inSelectedRange = true;
            }
          }
          return (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              onClick={() => handleClick(date)}
              className={cn(
                'relative flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors',
                !inMonth && 'text-white/20',
                inMonth && !selected && !inSelectedRange && !isDisabled && 'text-white/80 hover:bg-white/10',
                isDisabled && 'cursor-not-allowed text-white/20 line-through',
                today && !selected && !inSelectedRange && 'ring-1 ring-white/20',
                inSelectedRange && 'bg-white/10 text-white',
                selected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                isRangeStart && 'rounded-r-none',
                isRangeEnd && 'rounded-l-none',
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
