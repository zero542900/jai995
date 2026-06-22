'use client';

import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  getPeriodRecords,
  createPeriodRecord,
  savePeriodRecord,
  deletePeriodRecord,
} from '@/lib/storage';
import type { PeriodRecord, FlowLevel } from '@/lib/types';

// ========== Date helpers ==========

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

function daysBetween(a: string, b: string): number {
  const d1 = parseDate(a);
  const d2 = parseDate(b);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function getMonthMatrix(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  for (let i = 0; i < startWeekday; i++) currentWeek.push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

// ========== Flow styles ==========

const flowConfig: Record<FlowLevel, { label: string; color: string; bg: string }> = {
  light: { label: '少', color: '#F5B0B0', bg: 'rgba(245,176,176,0.35)' },
  medium: { label: '中', color: '#E08080', bg: 'rgba(224,128,128,0.45)' },
  heavy: { label: '多', color: '#C05050', bg: 'rgba(192,80,80,0.55)' },
};

const PREDICTED_BG = 'rgba(200,170,170,0.15)';
const OVULATION_COLOR = '#7DB8A0';

export default function CalendarPage() {
  const [records, setRecords] = useState<PeriodRecord[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRecords(getPeriodRecords().sort((a, b) => a.startDate.localeCompare(b.startDate)));
    setMounted(true);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthMatrix = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const todayStr = toDateStr(new Date());

  // ========== Calculate cycle stats (based on user-provided algorithm) ==========

  const cycleStats = useMemo(() => {
    if (!records || records.length < 2) return null;

    // 1. 计算所有有效周期长度（21-60天）
    const cycles: number[] = [];
    for (let i = 1; i < records.length; i++) {
      const diff = daysBetween(records[i - 1].startDate, records[i].startDate);
      if (diff >= 21 && diff <= 60) {
        cycles.push(diff);
      }
    }

    // 所有周期被过滤，回退到最近两次原始天数
    if (cycles.length === 0) {
      const lastTwoDiff = daysBetween(
        records[records.length - 2].startDate,
        records[records.length - 1].startDate
      );
      cycles.push(lastTwoDiff);
    }

    // 2. 平均周期
    const avgCycle = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);

    // 3. 经期平均长度（过滤异常 0-15天）
    const periodLengths: number[] = [];
    for (const r of records) {
      if (r.endDate) {
        const len = daysBetween(r.startDate, r.endDate) + 1;
        if (len > 0 && len <= 15) {
          periodLengths.push(len);
        }
      }
    }
    const avgPeriod = periodLengths.length > 0
      ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
      : 5;

    // 4. 预测下一次月经开始日
    const lastStart = records[records.length - 1].startDate;
    const nextStart = addDays(lastStart, avgCycle);

    // 5. 预测结束日
    const nextEnd = addDays(nextStart, avgPeriod - 1);

    // 6. 排卵日（黄体期固定14天）
    const ovulation = addDays(nextStart, -14);

    // 7. 周期波动范围
    const cycleMin = Math.min(...cycles);
    const cycleMax = Math.max(...cycles);

    return {
      avgCycle,
      avgPeriod,
      nextStart,
      nextEnd,
      ovulation,
      cycleCount: cycles.length,
      cycleMin,
      cycleMax,
    };
  }, [records]);

  // ========== Compute period day sets & predictions ==========

  const { periodDays, predictedDays, ovulationDays } = useMemo(() => {
    const pDays = new Set<string>();
    const oDays = new Set<string>();

    for (const r of records) {
      const len = daysBetween(r.startDate, r.endDate);
      for (let i = 0; i <= len; i++) {
        pDays.add(addDays(r.startDate, i));
      }
    }

    const predDays = new Set<string>();
    if (cycleStats) {
      for (let i = 0; i < cycleStats.avgPeriod; i++) {
        const d = addDays(cycleStats.nextStart, i);
        if (!pDays.has(d)) predDays.add(d);
      }
      oDays.add(cycleStats.ovulation);
    } else if (records.length === 1) {
      // 单条记录默认28天周期
      const lastStart = records[0].startDate;
      const nextStart = addDays(lastStart, 28);
      for (let i = 0; i < 5; i++) {
        const d = addDays(nextStart, i);
        if (!pDays.has(d)) predDays.add(d);
      }
      oDays.add(addDays(nextStart, -14));
    }

    return { periodDays: pDays, predictedDays: predDays, ovulationDays: oDays };
  }, [records, cycleStats]);

  // ========== Summary stats ==========

  const summary = useMemo(() => {
    if (records.length === 0) return null;

    if (!cycleStats) {
      // 单条记录
      const lastStart = records[0].startDate;
      const nextPredicted = addDays(lastStart, 28);
      const daysUntilNext = daysBetween(todayStr, nextPredicted);
      const periodLen = daysBetween(records[0].startDate, records[0].endDate) + 1;
      return {
        avgCycle: 0,
        avgPeriod: periodLen,
        nextPredicted,
        daysUntilNext,
        cycleMin: 0,
        cycleMax: 0,
      };
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
  }, [records, todayStr, cycleStats]);

  // ========== Day info lookup ==========

  function getDayRecord(dateStr: string): PeriodRecord | undefined {
    return records.find((r) => {
      const len = daysBetween(r.startDate, r.endDate);
      for (let i = 0; i <= len; i++) {
        if (addDays(r.startDate, i) === dateStr) return true;
      }
      return false;
    });
  }

  function getDayStatus(dateStr: string): 'period' | 'predicted' | 'ovulation' | 'today' | 'normal' {
    if (periodDays.has(dateStr)) return 'period';
    if (ovulationDays.has(dateStr)) return 'ovulation';
    if (predictedDays.has(dateStr)) return 'predicted';
    if (dateStr === todayStr) return 'today';
    return 'normal';
  }

  // ========== Actions ==========

  function handleDayClick(dateStr: string) {
    setSelectedDate(dateStr);
  }

  function handleSaveRecord(startDate: string, endDate: string, flow: FlowLevel, notes: string, existingId?: string) {
    if (existingId) {
      const existing = records.find((r) => r.id === existingId);
      if (existing) {
        savePeriodRecord({ ...existing, startDate, endDate, flow, notes, updatedAt: Date.now() });
      }
    } else {
      createPeriodRecord(startDate, endDate, flow, notes);
    }
    setRecords(getPeriodRecords().sort((a, b) => a.startDate.localeCompare(b.startDate)));
    setSelectedDate(null);
  }

  function handleDeleteRecord(id: string) {
    deletePeriodRecord(id);
    setRecords(getPeriodRecords().sort((a, b) => a.startDate.localeCompare(b.startDate)));
    setSelectedDate(null);
  }

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
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
              const record = getDayRecord(dateStr);

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
                      ? { backgroundColor: record ? flowConfig[record.flow].bg : 'rgba(200,80,80,0.4)' }
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
                  {status === 'period' && record && (
                    <span className="text-[8px] text-jai-accent opacity-70 leading-none">
                      {flowConfig[record.flow].label}
                    </span>
                  )}
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

        {records.length === 0 && (
          <div className="mt-6 text-center text-sm text-jai-text-secondary py-8">
            点击日期记录经期开始日，记录两次后自动预测周期
          </div>
        )}
      </div>

      {/* Day modal */}
      {selectedDate && (
        <DayModal
          dateStr={selectedDate}
          record={getDayRecord(selectedDate)}
          status={getDayStatus(selectedDate)}
          onSave={handleSaveRecord}
          onDelete={handleDeleteRecord}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

// ========== Day Modal Component ==========

function DayModal({
  dateStr,
  record,
  status,
  onSave,
  onDelete,
  onClose,
}: {
  dateStr: string;
  record?: PeriodRecord;
  status: string;
  onSave: (startDate: string, endDate: string, flow: FlowLevel, notes: string, existingId?: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const existingRecord = record && record.startDate === dateStr ? record : undefined;

  const [startDate, setStartDate] = useState(existingRecord?.startDate || dateStr);
  const [endDate, setEndDate] = useState(existingRecord?.endDate || addDays(dateStr, 4));
  const [flow, setFlow] = useState<FlowLevel>(existingRecord?.flow || 'medium');
  const [notes, setNotes] = useState(existingRecord?.notes || '');

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

        {/* Date range */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs text-jai-text-secondary block mb-1">开始日</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-lg bg-jai-input-bg border border-jai-card-border text-sm text-jai-text focus:outline-none focus:border-jai-accent"
            />
          </div>
          <div>
            <label className="text-xs text-jai-text-secondary block mb-1">结束日</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-jai-input-bg border border-jai-card-border text-sm text-jai-text focus:outline-none focus:border-jai-accent"
            />
          </div>
        </div>

        {/* Flow selection */}
        <div className="mb-4">
          <label className="text-xs text-jai-text-secondary block mb-1.5">流量</label>
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
          {existingRecord && (
            <button
              onClick={() => onDelete(existingRecord.id)}
              className="px-4 py-2 rounded-full text-xs font-medium text-red-400 hover:bg-red-50 transition-colors"
            >
              删除
            </button>
          )}
          <button
            onClick={() => onSave(startDate, endDate, flow, notes, existingRecord?.id)}
            className="flex-1 py-2 rounded-full text-sm font-medium text-white transition-all hover:opacity-90 bg-jai-accent"
          >
            {existingRecord ? '保存修改' : '记录经期'}
          </button>
        </div>
      </div>
    </div>
  );
}
