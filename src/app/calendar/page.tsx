'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  getPeriodDays,
  savePeriodDay,
  createPeriodDay,
  deletePeriodDay,
} from '@/lib/storage';
import type { PeriodDay, FlowLevel } from '@/lib/types';

// ========== Constants ==========

const PREDICTED_BG = 'rgba(200, 130, 130, 0.18)';
const OVULATION_COLOR = '#7DB8A0';

const flowConfig: Record<FlowLevel, { label: string; bg: string; color: string }> = {
  light: { label: '少', bg: 'rgba(200, 130, 130, 0.35)', color: '#C4A2A2' },
  medium: { label: '中', bg: 'rgba(200, 100, 100, 0.5)', color: '#B06868' },
  heavy: { label: '多', bg: 'rgba(200, 80, 80, 0.7)', color: '#9C4848' },
};

// ========== Date utils ==========

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

// ========== Cycle calculation ==========

interface CycleStats {
  avgCycle: number;
  avgPeriod: number;
  nextStart: string;
  nextEnd: string;
  ovulation: string;
  cycleCount: number;
  cycleMin: number;
  cycleMax: number;
}

interface PeriodSegment {
  startDate: string;
  endDate: string;
  days: string[]; // all date strings in this segment
}

/**
 * 从逐日记录中提取连续的经期段
 * 连续日期（间隔<=2天视为连续，容忍偶尔漏记）组成一个经期段
 */
function extractSegments(dayRecords: PeriodDay[]): PeriodSegment[] {
  if (dayRecords.length === 0) return [];

  const sorted = [...dayRecords].sort((a, b) => a.date.localeCompare(b.date));

  // If any manual start markers exist, split segments by them
  const startDays = sorted.filter((d) => d.isStart);

  if (startDays.length > 0) {
    const segments: PeriodSegment[] = [];
    for (let s = 0; s < startDays.length; s++) {
      const segStart = startDays[s].date;
      const nextStart = s + 1 < startDays.length ? startDays[s + 1].date : '9999-12-31';
      const segDays = sorted.filter((d) => d.date >= segStart && d.date < nextStart);
      if (segDays.length === 0) continue;
      const segEnd = segDays.find((d) => d.isEnd)?.date || segDays[segDays.length - 1].date;
      segments.push({
        startDate: segStart,
        endDate: segEnd,
        days: segDays.map((d) => d.date),
      });
    }
    return segments;
  }

  // Fallback: auto-detect by gap <= 2 days
  const segments: PeriodSegment[] = [];
  let currentSegment: PeriodSegment = {
    startDate: sorted[0].date,
    endDate: sorted[0].date,
    days: [sorted[0].date],
  };

  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].date, sorted[i].date);
    if (gap <= 2) {
      if (sorted[i].isEnd) currentSegment.endDate = sorted[i].date;
      else if (!currentSegment.days.some((d) => dayRecords.find((r) => r.date === d)?.isEnd)) {
        currentSegment.endDate = sorted[i].date;
      }
      currentSegment.days.push(sorted[i].date);
    } else {
      segments.push(currentSegment);
      currentSegment = {
        startDate: sorted[i].date,
        endDate: sorted[i].date,
        days: [sorted[i].date],
      };
    }
  }
  segments.push(currentSegment);
  return segments;
}

function calculateCycle(segments: PeriodSegment[]): CycleStats | null {
  if (segments.length < 2) return null;

  // 1. 周期长度（相邻段开始日之间的天数）
  const cycles: number[] = [];
  for (let i = 1; i < segments.length; i++) {
    const diff = daysBetween(segments[i - 1].startDate, segments[i].startDate);
    if (diff >= 21 && diff <= 60) {
      cycles.push(diff);
    }
  }

  if (cycles.length === 0) {
    const lastTwoDiff = daysBetween(
      segments[segments.length - 2].startDate,
      segments[segments.length - 1].startDate
    );
    cycles.push(lastTwoDiff);
  }

  const avgCycle = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);

  // 2. 经期平均长度
  const periodLengths = segments.map((s) => s.days.length).filter((len) => len > 0 && len <= 15);
  const avgPeriod = periodLengths.length > 0
    ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
    : 5;

  // 3. 预测下次经期
  const lastStart = segments[segments.length - 1].startDate;
  const nextStart = addDays(lastStart, avgCycle);
  const nextEnd = addDays(nextStart, avgPeriod - 1);
  const ovulation = addDays(nextStart, -14);

  return {
    avgCycle,
    avgPeriod,
    nextStart,
    nextEnd,
    ovulation,
    cycleCount: cycles.length,
    cycleMin: Math.min(...cycles),
    cycleMax: Math.max(...cycles),
  };
}

// ========== Main Component ==========

export default function CalendarPage() {
  const [mounted, setMounted] = useState(false);
  const [dayRecords, setDayRecords] = useState<PeriodDay[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const todayStr = toDateStr(today);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    setMounted(true);
    setDayRecords(getPeriodDays());
  }, []);

  // ========== Segments & cycle stats ==========

  const segments = useMemo(() => extractSegments(dayRecords), [dayRecords]);
  const cycleStats = useMemo(() => calculateCycle(segments), [segments]);

  // ========== Day sets ==========

  const { periodDaysMap, predictedDays, ovulationDays } = useMemo(() => {
    const pMap = new Map<string, FlowLevel>();
    for (const r of dayRecords) {
      pMap.set(r.date, r.flow);
    }

    const predDays = new Set<string>();
    if (cycleStats) {
      for (let i = 0; i < cycleStats.avgPeriod; i++) {
        const d = addDays(cycleStats.nextStart, i);
        if (!pMap.has(d)) predDays.add(d);
      }
    } else if (segments.length === 1) {
      const nextStart = addDays(segments[0].startDate, 28);
      for (let i = 0; i < 5; i++) {
        const d = addDays(nextStart, i);
        if (!pMap.has(d)) predDays.add(d);
      }
    }

    const oDays = new Set<string>();
    if (cycleStats) {
      oDays.add(cycleStats.ovulation);
    } else if (segments.length === 1) {
      oDays.add(addDays(segments[0].startDate, 28 - 14));
    }

    return { periodDaysMap: pMap, predictedDays: predDays, ovulationDays: oDays };
  }, [dayRecords, cycleStats, segments]);

  // ========== Summary ==========

  const summary = useMemo(() => {
    if (dayRecords.length === 0) return null;

    if (!cycleStats) {
      if (segments.length === 1) {
        const lastStart = segments[0].startDate;
        const nextPredicted = addDays(lastStart, 28);
        const daysUntilNext = daysBetween(todayStr, nextPredicted);
        return {
          avgCycle: 0,
          avgPeriod: segments[0].days.length,
          nextPredicted,
          daysUntilNext,
          cycleMin: 0,
          cycleMax: 0,
        };
      }
      return null;
    }

    const daysUntilNext = daysBetween(todayStr, cycleStats.nextStart);
    return {
      avgCycle: cycleStats.avgCycle,
      avgPeriod: cycleStats.avgPeriod,
      nextPredicted: cycleStats.nextStart,
      daysUntilNext,
      cycleMin: cycleStats.cycleMin,
      cycleMax: cycleStats.cycleMax,
    };
  }, [dayRecords, cycleStats, segments, todayStr]);

  // ========== Month matrix ==========

  const monthMatrix = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const weeks: (Date | null)[][] = [];
    let week: (Date | null)[] = [];

    for (let i = 0; i < startWeekday; i++) week.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(new Date(year, month, d));
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [year, month]);

  // ========== Day status ==========

  function getDayFlow(dateStr: string): FlowLevel | undefined {
    return periodDaysMap.get(dateStr);
  }

  function getDayRecord(dateStr: string): PeriodDay | undefined {
    return dayRecords.find(d => d.date === dateStr);
  }

  function getDayStatus(dateStr: string): 'period' | 'predicted' | 'ovulation' | 'today' | 'normal' {
    if (periodDaysMap.has(dateStr)) return 'period';
    if (ovulationDays.has(dateStr)) return 'ovulation';
    if (predictedDays.has(dateStr)) return 'predicted';
    if (dateStr === todayStr) return 'today';
    return 'normal';
  }

  // ========== Actions ==========

  function handleSaveDay(dateStr: string, flow: FlowLevel, notes: string, isStart: boolean, isEnd: boolean, existingId?: string) {
    if (existingId) {
      const existing = dayRecords.find((r) => r.id === existingId);
      if (existing) {
        savePeriodDay({ ...existing, flow, notes, isStart, isEnd, updatedAt: Date.now() });
      }
    } else {
      createPeriodDay(dateStr, flow, notes, isStart, isEnd);
    }
    setDayRecords(getPeriodDays());
    setSelectedDate(null);
  }

  function handleDeleteDay(date: string) {
    deletePeriodDay(date);
    setDayRecords(getPeriodDays());
    setSelectedDate(null);
  }

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      {/* Mobile settings gear */}
      <div className="md:hidden fixed top-0 right-0 z-30 p-3">
        <Link href="/settings" className="block p-2 rounded-lg text-jai-text-secondary hover:text-jai-accent transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6 pt-14 md:pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-jai-accent">周期日历</h1>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg text-jai-text-secondary hover:bg-jai-secondary/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-base font-semibold text-jai-accent">
            {year}年 {monthNames[month]}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg text-jai-text-secondary hover:bg-jai-secondary/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar grid */}
        <div className="bg-jai-card rounded-xl border border-jai-card-border p-3 md:p-4 shadow-sm">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map((w) => (
              <div key={w} className="text-center text-xs text-jai-text-secondary py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {monthMatrix.flat().map((date, idx) => {
              if (!date) return <div key={idx} className="aspect-square" />;
              const dateStr = toDateStr(date);
              const status = getDayStatus(dateStr);
              const flow = getDayFlow(dateStr);

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(dateStr)}
                  className={cn(
                    'aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all relative',
                    status === 'today' && 'ring-1 ring-jai-accent',
                    status === 'period' && 'font-medium',
                    status === 'normal' && 'hover:bg-jai-secondary/10',
                  )}
                  style={
                    status === 'period'
                      ? { backgroundColor: flow ? flowConfig[flow].bg : 'rgba(200,80,80,0.4)' }
                      : status === 'predicted'
                        ? { backgroundColor: PREDICTED_BG }
                        : undefined
                  }
                >
                  <span
                    className={cn(
                      'text-xs',
                      status === 'period' && 'text-jai-accent font-semibold',
                      status === 'normal' && 'text-jai-text',
                      dateStr === todayStr && status !== 'period' && 'text-jai-accent font-bold',
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {/* Ovulation dot */}
                  {status === 'ovulation' && (
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-0.5"
                      style={{ backgroundColor: OVULATION_COLOR }}
                    />
                  )}
                  {/* Period day marker */}
                  {status === 'period' && flow && (
                    <span className="text-[8px] text-jai-accent opacity-70 leading-none">
                      {flowConfig[flow].label}
                    </span>
                  )}
                  {/* Start/End markers */}
                  {(() => {
                    const rec = getDayRecord(dateStr);
                    if (!rec) return null;
                    return (
                      <>
                        {rec.isStart && (
                          <span className="absolute top-0 left-0 w-2 h-2 rounded-full bg-jai-accent" />
                        )}
                        {rec.isEnd && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-jai-accent opacity-50" />
                        )}
                      </>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-jai-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: flowConfig.medium.bg }} />
            <span>经期</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: PREDICTED_BG }} />
            <span>预测期</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: OVULATION_COLOR }} />
            <span>排卵日</span>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className="mt-6 bg-jai-card rounded-xl border border-jai-card-border p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-jai-accent mb-3">周期小结</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-xl font-bold text-jai-accent">{summary.avgCycle || '—'}</div>
                <div className="text-xs text-jai-text-secondary mt-1">平均周期(天)</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-jai-accent">{summary.avgPeriod || '—'}</div>
                <div className="text-xs text-jai-text-secondary mt-1">平均经期(天)</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-jai-accent">
                  {summary.daysUntilNext > 0 ? summary.daysUntilNext : '已到'}
                </div>
                <div className="text-xs text-jai-text-secondary mt-1">距下次预计(天)</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-jai-card-border flex flex-col gap-1 text-xs text-jai-text-secondary text-center">
              <span>下次预计开始日：{summary.nextPredicted}</span>
              {summary.cycleMin > 0 && summary.cycleMax > 0 && (
                <span>周期波动范围：{summary.cycleMin} - {summary.cycleMax} 天</span>
              )}
            </div>
          </div>
        )}

        {dayRecords.length === 0 && (
          <div className="mt-6 text-center text-sm text-jai-text-secondary py-8">
            点击日期记录当天经期，记录两次后自动预测周期
          </div>
        )}
      </div>

      {/* Day modal */}
      {selectedDate && (
        <DayModal
          dateStr={selectedDate}
          dayRecord={dayRecords.find((r) => r.date === selectedDate)}
          onSave={handleSaveDay}
          onDelete={handleDeleteDay}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );

  function handleDayClick(dateStr: string) {
    setSelectedDate(dateStr);
  }
}

// ========== Day Modal Component ==========

function DayModal({
  dateStr,
  dayRecord,
  onSave,
  onDelete,
  onClose,
}: {
  dateStr: string;
  dayRecord?: PeriodDay;
  onSave: (dateStr: string, flow: FlowLevel, notes: string, isStart: boolean, isEnd: boolean, existingId?: string) => void;
  onDelete: (date: string) => void;
  onClose: () => void;
}) {
  const [flow, setFlow] = useState<FlowLevel>(dayRecord?.flow || 'medium');
  const [notes, setNotes] = useState(dayRecord?.notes || '');
  const [isStart, setIsStart] = useState(dayRecord?.isStart || false);
  const [isEnd, setIsEnd] = useState(dayRecord?.isEnd || false);

  const dateLabel = parseDate(dateStr).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full md:w-96 bg-jai-card rounded-t-2xl md:rounded-2xl border border-jai-card-border p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-jai-accent">{dateLabel}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-jai-text-secondary hover:text-jai-accent">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Flow selection */}
        <div className="mb-4">
          <label className="text-xs text-jai-text-secondary block mb-1.5">当日流量</label>
          <div className="flex gap-2">
            {(Object.keys(flowConfig) as FlowLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setFlow(level)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                  flow === level
                    ? 'text-jai-accent ring-1 ring-jai-accent'
                    : 'text-jai-text-secondary hover:text-jai-accent',
                )}
                style={flow === level ? { backgroundColor: flowConfig[level].bg } : undefined}
              >
                {flowConfig[level].label}
              </button>
            ))}
          </div>
        </div>

        {/* Start/End Markers */}
        <div className="mb-4 flex gap-3">
          <button
            onClick={() => setIsStart(!isStart)}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-medium border transition-all',
              isStart
                ? 'bg-jai-accent text-white border-jai-accent'
                : 'text-jai-text-secondary border-jai-card-border hover:border-jai-accent',
            )}
          >
            {isStart ? '✓ 经期开始' : '标记开始日'}
          </button>
          <button
            onClick={() => setIsEnd(!isEnd)}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-medium border transition-all',
              isEnd
                ? 'bg-jai-accent text-white border-jai-accent'
                : 'text-jai-text-secondary border-jai-card-border hover:border-jai-accent',
            )}
          >
            {isEnd ? '✓ 经期结束' : '标记结束日'}
          </button>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="text-xs text-jai-text-secondary block mb-1">备注</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="可选项..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-jai-input-bg border border-jai-card-border text-sm text-jai-text focus:outline-none focus:border-jai-accent resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {dayRecord && (
            <button
              onClick={() => onDelete(dateStr)}
              className="px-4 py-2 rounded-full text-xs font-medium text-red-400 hover:bg-red-50 transition-colors"
            >
              删除
            </button>
          )}
          <button
            onClick={() => onSave(dateStr, flow, notes, isStart, isEnd, dayRecord?.id)}
            className="flex-1 py-2 rounded-full text-sm font-medium text-white transition-all hover:opacity-90 bg-jai-accent"
          >
            {dayRecord ? '保存修改' : '记录当天'}
          </button>
        </div>
      </div>
    </div>
  );
}
