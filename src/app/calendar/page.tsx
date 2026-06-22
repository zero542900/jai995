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
  clearDoctorMessages,
  getDoctorSummary,
  saveDoctorSummary,
  deleteDoctorMessage,
  getWeightRecords,
  saveWeightRecord,
  deleteWeightRecord,
} from '@/lib/storage';
import { IconFlip } from '@/components/icons';
import type { PeriodDay, FlowLevel, HealthProfile, DoctorMessage, DoctorSummary, WeightRecord } from '@/lib/types';

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
  const [doctorTranslating, setDoctorTranslating] = useState<string | null>(null);
  const [doctorTranslations, setDoctorTranslations] = useState<Record<string, string>>({});
  const [doctorFlipped, setDoctorFlipped] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [medicalRecordsOpen, setMedicalRecordsOpen] = useState(false);
  const [doctorSummary, setDoctorSummary] = useState<DoctorSummary | null>(null);
  const doctorScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDoctorMessages(getDoctorMessages());
    setDoctorSummary(getDoctorSummary());
  }, []);

  function handleDeleteMessage(id: string) {
    const updated = deleteDoctorMessage(id);
    setDoctorMessages(updated);
    setConfirmDeleteId(null);
  }

  function handleClearAll() {
    clearDoctorMessages();
    setDoctorMessages([]);
    setDoctorSummary(null);
    setConfirmClearAll(false);
  }

  // ========== Weight records ==========
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [weightInputDate, setWeightInputDate] = useState(todayStr);
  const [weightInputVal, setWeightInputVal] = useState('');
  const [bodyFatInputVal, setBodyFatInputVal] = useState('');

  useEffect(() => {
    setWeightRecords(getWeightRecords());
  }, []);

  useEffect(() => {
    if (doctorScrollRef.current) {
      doctorScrollRef.current.scrollTop = doctorScrollRef.current.scrollHeight;
    }
  }, [doctorMessages]);

  // ========== Weight handlers ==========

  function handleSaveWeight() {
    const w = parseFloat(weightInputVal);
    if (!w || w <= 0) return;
    const bf = bodyFatInputVal ? parseFloat(bodyFatInputVal) : undefined;
    const existing = weightRecords.find((r) => r.date === weightInputDate);
    const record: WeightRecord = {
      id: existing?.id || crypto.randomUUID(),
      date: weightInputDate,
      weight: w,
      bodyFat: bf,
      note: existing?.note,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    saveWeightRecord(record);
    setWeightRecords(getWeightRecords());
    setWeightInputVal('');
    setBodyFatInputVal('');
  }

  function handleDeleteWeight(date: string) {
    deleteWeightRecord(date);
    setWeightRecords(getWeightRecords());
  }

  function handleLoadWeightToEdit(date: string) {
    const rec = weightRecords.find((r) => r.date === date);
    if (!rec) return;
    setWeightInputDate(date);
    setWeightInputVal(String(rec.weight));
    setBodyFatInputVal(rec.bodyFat ? String(rec.bodyFat) : '');
  }

  async function handleDoctorTranslate(msgId: string, content: string) {
    // Already translated → just flip
    if (doctorTranslations[msgId]) {
      setDoctorFlipped(prev => {
        const next = new Set(prev);
        if (next.has(msgId)) next.delete(msgId);
        else next.add(msgId);
        return next;
      });
      return;
    }
    // Need to translate first
    const apiKey = getApiKey();
    if (!apiKey) return;
    setDoctorTranslating(msgId);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, apiKey, context: 'House M.D. doctor message' }),
      });
      if (!res.ok) throw new Error('Translation failed');
      const data = await res.json();
      const translation = data.translation || '';
      setDoctorTranslations(prev => ({ ...prev, [msgId]: translation }));
      setDoctorFlipped(prev => new Set(prev).add(msgId));
    } catch {
      // silently fail
    } finally {
      setDoctorTranslating(null);
    }
  }

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
          userMessage: userMessage,
          messages: doctorMessages.slice(-10),
          summary: doctorSummary?.summary || null,
          healthProfile,
          weightRecords: weightRecords.slice(-30),
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

      // Compress if over 30 messages (15 rounds) - keep latest 10, summarize rest
      if (finalMessages.length > 30) {
        try {
          const apiKey = getApiKey();
          if (apiKey) {
            const toSummarize = finalMessages.slice(0, finalMessages.length - 10);
            const convText = toSummarize.map(m => `${m.role === 'user' ? '患者' : 'House'}: ${m.content}`).join('\n');
            const existingSummary = getDoctorSummary();
            const summarizeRes = await fetch('/api/doctor/summarize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: convText,
                existingSummary: existingSummary?.summary || null,
                apiKey,
              }),
            });
            if (summarizeRes.ok) {
              const sumData = await summarizeRes.json();
              const newSummary: DoctorSummary = {
                summary: sumData.summary,
                updatedAt: Date.now(),
                summarizedCount: toSummarize.length + (existingSummary?.summarizedCount || 0),
              };
              saveDoctorSummary(newSummary);
              setDoctorSummary(newSummary);
              // Keep only the latest 10 messages
              const trimmed = finalMessages.slice(-10);
              saveDoctorMessages(trimmed);
              setDoctorMessages(trimmed);
            }
          }
        } catch {
          // Compression failed, keep all messages
        }
      }
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

        {/* Weight tracking */}
        <div className="mt-6 bg-jai-card rounded-xl border border-jai-card-border p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-jai-accent mb-3">体重记录</h2>

          {/* Input row */}
          <div className="flex flex-wrap items-end gap-2 mb-4">
            <div>
              <label className="text-xs text-jai-text-secondary mb-1 block">日期</label>
              <input
                type="date"
                value={weightInputDate}
                max={todayStr}
                onChange={(e) => setWeightInputDate(e.target.value)}
                className="px-2 py-1.5 text-sm rounded-lg bg-jai-input-bg border border-jai-card-border text-jai-text focus:outline-none focus:border-jai-accent/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-jai-text-secondary mb-1 block">体重(kg)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weightInputVal}
                onChange={(e) => setWeightInputVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && weightInputVal) handleSaveWeight(); }}
                placeholder="52.3"
                className="w-20 px-2 py-1.5 text-sm rounded-lg bg-jai-input-bg border border-jai-card-border text-jai-text placeholder:text-jai-text-secondary/50 focus:outline-none focus:border-jai-accent/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-jai-text-secondary mb-1 block">体脂(%)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={bodyFatInputVal}
                onChange={(e) => setBodyFatInputVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && weightInputVal) handleSaveWeight(); }}
                placeholder="22.5"
                className="w-20 px-2 py-1.5 text-sm rounded-lg bg-jai-input-bg border border-jai-card-border text-jai-text placeholder:text-jai-text-secondary/50 focus:outline-none focus:border-jai-accent/50 transition-colors"
              />
            </div>
            <button
              onClick={handleSaveWeight}
              disabled={!weightInputVal}
              className="px-4 py-1.5 text-sm rounded-full bg-jai-accent/15 text-jai-accent hover:bg-jai-accent/25 transition-colors disabled:opacity-30"
            >
              {weightRecords.find(r => r.date === weightInputDate) ? '更新' : '记录'}
            </button>
          </div>

          {/* Chart */}
          {weightRecords.length >= 2 && (
            <WeightChart records={weightRecords} />
          )}

          {/* Record list */}
          {weightRecords.length > 0 && (
            <div className="mt-3 space-y-1">
              {[...weightRecords].reverse().slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg hover:bg-jai-secondary/5 transition-colors">
                  <span className="text-jai-text-secondary w-24">{r.date}</span>
                  <span className="text-jai-text font-medium w-16 text-right">{r.weight} kg</span>
                  <span className="text-jai-text-secondary w-16 text-right">{r.bodyFat ? `${r.bodyFat}%` : '—'}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleLoadWeightToEdit(r.date)}
                      className="p-1 rounded text-jai-text-secondary hover:text-jai-accent transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteWeight(r.date)}
                      className="p-1 rounded text-jai-text-secondary hover:text-red-400 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {weightRecords.length === 0 && (
            <div className="text-center text-xs text-jai-text-secondary py-4">
              记录体重和体脂率，自动生成趋势曲线
            </div>
          )}
        </div>

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
                  onClick={() => { setMedicalRecordsOpen(true); }}
                  className="p-1.5 rounded-lg text-jai-text-secondary hover:bg-jai-secondary/10 transition-colors"
                  title="医疗记录"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </button>
                <button
                  onClick={() => { setHealthProfileOpen(true); }}
                  className="p-1.5 rounded-lg text-jai-text-secondary hover:bg-jai-secondary/10 transition-colors"
                  title="健康档案"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setConfirmClearAll(true)}
                  className="p-1.5 rounded-lg text-jai-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  title="清空对话"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                <div key={msg.id} className={cn('flex flex-col gap-0.5 group', msg.role === 'user' ? 'items-end' : 'items-start')}>
                  {confirmDeleteId === msg.id ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
                      <span className="text-[11px] text-red-600">删除这条？</span>
                      <button onClick={() => handleDeleteMessage(msg.id)} className="text-[11px] px-2 py-0.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors">删除</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] px-2 py-0.5 rounded-md text-jai-text-secondary hover:bg-jai-secondary/10 transition-colors">取消</button>
                    </div>
                  ) : (
                    <>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words',
                      msg.role === 'user'
                        ? 'bg-jai-accent/15 text-jai-text'
                        : 'bg-jai-secondary/10 text-jai-text'
                    )}
                  >
                    {doctorFlipped.has(msg.id) && doctorTranslations[msg.id]
                      ? doctorTranslations[msg.id]
                      : msg.content || '...'}
                  </div>
                  <div className={cn('flex items-center gap-2 px-1', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                    <span className="text-[10px] text-jai-text-secondary/60">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleDoctorTranslate(msg.id, msg.content)}
                        disabled={doctorTranslating === msg.id}
                        title="翻译"
                        className="flex items-center gap-0.5 text-[10px] text-jai-text-secondary/60 hover:text-jai-accent transition-colors disabled:opacity-40"
                      >
                        <IconFlip className="w-2.5 h-2.5" />
                        {doctorTranslating === msg.id ? '...' : ''}
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteId(msg.id)}
                      title="删除"
                      className="text-[10px] text-jai-text-secondary/60 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                    </>
                  )}
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

      {/* Confirm clear all */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30" onClick={() => setConfirmClearAll(false)}>
          <div className="bg-jai-card rounded-xl border border-jai-card-border p-5 max-w-[280px] w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-medium text-jai-text mb-1">清空所有对话？</div>
            <div className="text-xs text-jai-text-secondary mb-4">包括历史摘要也会一起删除，不可恢复。</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmClearAll(false)} className="px-3 py-1.5 text-xs rounded-lg text-jai-text-secondary hover:bg-jai-secondary/10 transition-colors">取消</button>
              <button onClick={handleClearAll} className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">清空</button>
            </div>
          </div>
        </div>
      )}

      {/* Medical records modal */}
      {medicalRecordsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30" onClick={() => setMedicalRecordsOpen(false)}>
          <div className="bg-jai-card rounded-xl border border-jai-card-border p-5 max-w-md w-full mx-4 shadow-xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-jai-accent">医疗记录</div>
              <button onClick={() => setMedicalRecordsOpen(false)} className="p-1 rounded-lg text-jai-text-secondary hover:bg-jai-secondary/10">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3">
              {doctorSummary ? (
                <div className="bg-jai-secondary/8 rounded-lg p-3 border border-jai-card-border">
                  <div className="text-[10px] text-jai-text-secondary mb-1">历史摘要 · 更新于 {new Date(doctorSummary.updatedAt).toLocaleString('zh-CN')}</div>
                  <div className="text-xs text-jai-text leading-relaxed whitespace-pre-wrap">{doctorSummary.summary}</div>
                </div>
              ) : (
                <div className="text-center text-xs text-jai-text-secondary py-4">暂无历史摘要</div>
              )}
              <div className="text-[10px] text-jai-text-secondary font-medium pt-2 border-t border-jai-card-border">近期对话</div>
              {doctorMessages.length === 0 ? (
                <div className="text-center text-xs text-jai-text-secondary py-4">暂无对话记录</div>
              ) : (
                doctorMessages.map(msg => (
                  <div key={msg.id} className="flex flex-col gap-0.5">
                    <div className="text-[10px] text-jai-text-secondary/60">{msg.role === 'user' ? '患者' : 'House'} · {new Date(msg.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                    <div className={cn('text-xs rounded-lg px-2 py-1.5', msg.role === 'user' ? 'bg-jai-accent/10 text-jai-text' : 'bg-jai-secondary/8 text-jai-text')}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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

// ========== Weight Chart Component ==========

function WeightChart({ records }: { records: WeightRecord[] }) {
  const W = 300;
  const H = 140;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const plotW = W - padding.left - padding.right;
  const plotH = H - padding.top - padding.bottom;

  const recent = records.slice(-30);
  const dates = recent.map((r) => new Date(r.date).getTime());
  const weights = recent.map((r) => r.weight);
  const bodyFats = recent.map((r) => r.bodyFat).filter((v): v is number => v != null);

  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 1;

  const wMin = Math.min(...weights) - 1;
  const wMax = Math.max(...weights) + 1;
  const wRange = wMax - wMin || 1;

  const hasBodyFat = bodyFats.length >= 2;
  const bfMin = hasBodyFat ? Math.min(...bodyFats) - 1 : 0;
  const bfMax = hasBodyFat ? Math.max(...bodyFats) + 1 : 1;
  const bfRange = (bfMax - bfMin) || 1;

  function xPos(dateStr: string): number {
    const t = new Date(dateStr).getTime();
    return padding.left + ((t - minDate) / dateRange) * plotW;
  }
  function wPos(w: number): number {
    return padding.top + (1 - (w - wMin) / wRange) * plotH;
  }
  function bfPos(bf: number): number {
    return padding.top + (1 - (bf - bfMin) / bfRange) * plotH;
  }

  const weightLine = recent.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xPos(r.date).toFixed(1)} ${wPos(r.weight).toFixed(1)}`).join(' ');
  const bodyFatLine = hasBodyFat
    ? recent.filter((r) => r.bodyFat != null).map((r, i) => `${i === 0 ? 'M' : 'L'} ${xPos(r.date).toFixed(1)} ${bfPos(r.bodyFat!).toFixed(1)}`).join(' ')
    : '';

  // Y-axis labels for weight (left)
  const wTicks = [wMin, (wMin + wMax) / 2, wMax];
  // Y-axis labels for bodyFat (right)
  const bfTicks = hasBodyFat ? [bfMin, (bfMin + bfMax) / 2, bfMax] : [];

  // X-axis labels: first, middle, last
  const xTicks = recent.length <= 1 ? [] : [recent[0], recent[Math.floor(recent.length / 2)], recent[recent.length - 1]];

  function fmtDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        {/* Grid lines */}
        {wTicks.map((t, i) => (
          <line key={`wgrid-${i}`} x1={padding.left} y1={wPos(t)} x2={W - padding.right} y2={wPos(t)} stroke="var(--color-jai-card-border)" strokeWidth={0.5} strokeDasharray="2 3" />
        ))}

        {/* Weight line */}
        <path d={weightLine} fill="none" stroke="var(--color-jai-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {recent.map((r, i) => (
          <circle key={`wdot-${i}`} cx={xPos(r.date)} cy={wPos(r.weight)} r={2.5} fill="var(--color-jai-card)" stroke="var(--color-jai-accent)" strokeWidth={1.5} />
        ))}

        {/* BodyFat line */}
        {hasBodyFat && (
          <>
            <path d={bodyFatLine} fill="none" stroke="var(--color-jai-success)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
            {recent.filter((r) => r.bodyFat != null).map((r, i) => (
              <circle key={`bfdot-${i}`} cx={xPos(r.date)} cy={bfPos(r.bodyFat!)} r={2} fill="var(--color-jai-card)" stroke="var(--color-jai-success)" strokeWidth={1} />
            ))}
          </>
        )}

        {/* Y-axis labels - weight (left) */}
        {wTicks.map((t, i) => (
          <text key={`wy-${i}`} x={padding.left - 4} y={wPos(t) + 3} textAnchor="end" fontSize={9} fill="var(--color-jai-text-secondary)">{t.toFixed(0)}</text>
        ))}

        {/* Y-axis labels - bodyFat (right) */}
        {hasBodyFat && bfTicks.map((t, i) => (
          <text key={`bfy-${i}`} x={W - padding.right + 4} y={bfPos(t) + 3} textAnchor="start" fontSize={9} fill="var(--color-jai-success)">{t.toFixed(0)}%</text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((r, i) => (
          <text key={`xl-${i}`} x={xPos(r.date)} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--color-jai-text-secondary)">{fmtDate(r.date)}</text>
        ))}

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${H - 8})`}>
          <line x1={0} y1={-3} x2={12} y2={-3} stroke="var(--color-jai-accent)" strokeWidth={2} />
          <text x={16} y={0} fontSize={9} fill="var(--color-jai-text-secondary)">体重</text>
          {hasBodyFat && (
            <>
              <line x1={60} y1={-3} x2={72} y2={-3} stroke="var(--color-jai-success)" strokeWidth={1.5} strokeDasharray="4 2" />
              <text x={76} y={0} fontSize={9} fill="var(--color-jai-text-secondary)">体脂</text>
            </>
          )}
        </g>
      </svg>
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
