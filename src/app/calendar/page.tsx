'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  getPeriodDays,
  savePeriodDay,
  createPeriodDay,
  deletePeriodDay,
  getApiKey,
  getHealthProfile,
  saveHealthProfile,
  getDoctorMessages,
  saveDoctorMessages,
} from '@/lib/storage';
import type { PeriodDay, FlowLevel, HealthProfile, DoctorMessage } from '@/lib/types';

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

  // ========== Doctor panel ==========
  const [doctorPanelOpen, setDoctorPanelOpen] = useState(false);
  const [healthProfileOpen, setHealthProfileOpen] = useState(false);
  const [doctorMessages, setDoctorMessages] = useState<DoctorMessage[]>([]);
  const [doctorInput, setDoctorInput] = useState('');
  const [doctorStreaming, setDoctorStreaming] = useState(false);
  const doctorScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDoctorMessages(getDoctorMessages());
  }, []);

  useEffect(() => {
    if (doctorScrollRef.current) {
      doctorScrollRef.current.scrollTop = doctorScrollRef.current.scrollHeight;
    }
  }, [doctorMessages]);

  async function sendToDoctor(userMessage: string) {
    const apiKey = getApiKey();
    if (!apiKey) {
      const errorMsg: DoctorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '先去设置页填 API Key，我可没空等你。',
        timestamp: Date.now(),
      };
      setDoctorMessages(prev => [...prev, errorMsg]);
      saveDoctorMessages([...doctorMessages, errorMsg]);
      return;
    }

    const userMsg: DoctorMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    const updatedMessages = [...doctorMessages, userMsg];
    setDoctorMessages(updatedMessages);
    saveDoctorMessages(updatedMessages);
    setDoctorInput('');
    setDoctorStreaming(true);

    const healthProfile = getHealthProfile();
    try {
      const res = await fetch('/api/doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: doctorMessages.slice(-10),
          healthProfile,
          cycleData: {
            today: todayStr,
            dayRecords: dayRecords.slice(-30),
            cycleStats,
            summary,
          },
          apiKey,
        }),
      });

      if (!res.ok) throw new Error('Doctor API failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const assistantMsg: DoctorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      setDoctorMessages(prev => [...prev, assistantMsg]);

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullText += data.content;
                setDoctorMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText };
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      }

      const finalMessages = [...updatedMessages, { ...assistantMsg, content: fullText }];
      saveDoctorMessages(finalMessages);
    } catch {
      const errorMsg: DoctorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '...网络炸了，跟你的身体一样不靠谱。',
        timestamp: Date.now(),
      };
      setDoctorMessages(prev => [...prev, errorMsg]);
      saveDoctorMessages([...updatedMessages, errorMsg]);
    } finally {
      setDoctorStreaming(false);
    }
  }

  // Auto-greeting on first open of the day
  const lastGreetingDate = typeof window !== 'undefined' ? localStorage.getItem('doctor_last_greeting') : null;
  useEffect(() => {
    if (mounted && lastGreetingDate !== todayStr && doctorMessages.length === 0) {
      localStorage.setItem('doctor_last_greeting', todayStr);
      sendToDoctor('（自动日报）请根据我的周期数据给我今天的评价');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

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

      {/* Doctor floating button */}
      {!doctorPanelOpen && !healthProfileOpen && (
        <button
          onClick={() => setDoctorPanelOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 w-14 h-14 rounded-full bg-jai-accent text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-20"
          title="豪斯医生"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          </svg>
        </button>
      )}

      {/* Doctor chat panel */}
      {doctorPanelOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-end p-0 md:p-6">
          <div className="absolute inset-0 bg-black/20" onClick={() => setDoctorPanelOpen(false)} />
          <div className="relative w-full md:w-96 bg-jai-card rounded-t-2xl md:rounded-2xl border border-jai-card-border shadow-xl flex flex-col pb-[env(safe-area-inset-bottom)]" style={{ maxHeight: '70vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-jai-card-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-jai-accent/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-jai-accent" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-jai-accent">House</div>
                  <div className="text-[10px] text-jai-text-secondary">诊断中...随时在线</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setDoctorPanelOpen(false); setHealthProfileOpen(true); }}
                  className="p-1.5 rounded-lg text-jai-text-secondary hover:bg-jai-secondary/10 transition-colors"
                  title="健康档案"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDoctorPanelOpen(false)}
                  className="p-1.5 rounded-lg text-jai-text-secondary hover:bg-jai-secondary/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={doctorScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {doctorMessages.length === 0 && (
                <div className="text-center text-xs text-jai-text-secondary py-8">
                  跟我说点什么，或者报一下今天的状态
                </div>
              )}
              {doctorMessages.map(msg => (
                <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                      msg.role === 'user'
                        ? 'bg-jai-accent/15 text-jai-text'
                        : 'bg-jai-secondary/10 text-jai-text'
                    )}
                  >
                    {msg.content || '...'}
                  </div>
                </div>
              ))}
              {doctorStreaming && (
                <div className="flex justify-start">
                  <div className="bg-jai-secondary/10 rounded-2xl px-3 py-2 text-sm text-jai-text-secondary">
                    <span className="inline-block w-2 h-4 bg-jai-accent/50 animate-pulse" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-jai-card-border">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={doctorInput}
                  onChange={(e) => setDoctorInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && doctorInput.trim() && !doctorStreaming) { sendToDoctor(doctorInput.trim()); } }}
                  placeholder="上报状态或提问..."
                  disabled={doctorStreaming}
                  className="flex-1 px-3 py-2 text-sm rounded-xl bg-jai-bg border border-jai-card-border text-jai-text placeholder:text-jai-text-secondary/50 focus:outline-none focus:border-jai-accent/50 transition-colors"
                />
                <button
                  onClick={() => { if (doctorInput.trim() && !doctorStreaming) { sendToDoctor(doctorInput.trim()); } }}
                  disabled={doctorStreaming || !doctorInput.trim()}
                  className="w-9 h-9 rounded-xl bg-jai-accent/15 text-jai-accent flex items-center justify-center disabled:opacity-30 hover:bg-jai-accent/25 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Health profile modal */}
      {healthProfileOpen && (
        <HealthProfileModal onClose={() => setHealthProfileOpen(false)} />
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

// ========== Health Profile Modal Component ==========

function HealthProfileModal({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<HealthProfile>(() => {
    const saved = getHealthProfile();
    return saved || { age: '', heightWeight: '', medicalHistory: '', currentMedications: '', allergies: '', notes: '', updatedAt: 0 };
  });

  const handleSave = () => {
    saveHealthProfile({ ...profile, updatedAt: Date.now() });
    onClose();
  };

  const fieldClass = "w-full px-3 py-2 text-sm rounded-xl bg-jai-bg border border-jai-card-border text-jai-text placeholder:text-jai-text-secondary/50 focus:outline-none focus:border-jai-accent/50 transition-colors";
  const labelClass = "text-xs font-medium text-jai-text-secondary mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-jai-card rounded-2xl border border-jai-card-border shadow-xl p-5 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-jai-accent">健康档案</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-jai-text-secondary hover:bg-jai-secondary/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>年龄</label>
            <input type="text" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} placeholder="如 28" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>身高体重</label>
            <input type="text" value={profile.heightWeight} onChange={(e) => setProfile({ ...profile, heightWeight: e.target.value })} placeholder="如 165cm / 55kg" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>既往病史</label>
            <textarea value={profile.medicalHistory} onChange={(e) => setProfile({ ...profile, medicalHistory: e.target.value })} placeholder="如 多囊卵巢综合征、贫血..." rows={2} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>正在服用的药物</label>
            <textarea value={profile.currentMedications} onChange={(e) => setProfile({ ...profile, currentMedications: e.target.value })} placeholder="如 布洛芬、维生素D..." rows={2} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>过敏史</label>
            <input type="text" value={profile.allergies} onChange={(e) => setProfile({ ...profile, allergies: e.target.value })} placeholder="如 青霉素过敏" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>备注</label>
            <textarea value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} placeholder="其他需要豪斯知道的..." rows={3} className={fieldClass} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-full text-sm border border-jai-card-border text-jai-text-secondary hover:bg-jai-secondary/10 transition-colors">取消</button>
          <button onClick={handleSave} className="flex-1 py-2 rounded-full text-sm font-medium text-white bg-jai-accent hover:opacity-90 transition-opacity">保存</button>
        </div>
      </div>
    </div>
  );
}
