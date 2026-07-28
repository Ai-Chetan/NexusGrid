import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { layoutApi } from '../../lib/apiClient';
import { ChevronRight, ArrowLeft, Loader2, Monitor, FileDown } from 'lucide-react';
import { generatePdfReport } from '../../lib/pdfReport';
import type { PdfReportOptions } from '../../lib/pdfReport';
import type { 
  AnalyticsYearlyResponse, 
  AnalyticsMonthlyResponse, 
  AnalyticsDailyResponse, 
  AnalyticsIntradayResponse 
} from '../../types';

interface Props {
  itemId: number;
  hostname: string;
}

type Level = 'yearly' | 'monthly' | 'daily' | 'intraday';

export function UptimeDrillDown({ itemId, hostname }: Props) {
  const [level, setLevel] = useState<Level>('yearly');
  
  // Drill-down state
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 1. Yearly Query
  const { data: yearlyData, isLoading: yearLoading } = useQuery<AnalyticsYearlyResponse>({
    queryKey: ['analytics-yearly', itemId],
    queryFn: () => layoutApi.getAnalyticsYearly(itemId).then((r) => r.data as AnalyticsYearlyResponse),
    enabled: level === 'yearly' && Number.isFinite(itemId),
  });

  // 2. Monthly Query
  const { data: monthlyData, isLoading: monthLoading } = useQuery<AnalyticsMonthlyResponse>({
    queryKey: ['analytics-monthly', itemId, selectedYear],
    queryFn: () => layoutApi.getAnalyticsMonthly(itemId, selectedYear!).then((r) => r.data as AnalyticsMonthlyResponse),
    enabled: level === 'monthly' && selectedYear !== null,
  });

  // 3. Daily Query
  const { data: dailyData, isLoading: dayLoading } = useQuery<AnalyticsDailyResponse>({
    queryKey: ['analytics-daily', itemId, selectedYear, selectedMonth],
    queryFn: () => layoutApi.getAnalyticsDaily(itemId, selectedYear!, selectedMonth!).then((r) => r.data as AnalyticsDailyResponse),
    enabled: level === 'daily' && selectedYear !== null && selectedMonth !== null,
  });

  // 4. Intraday Query
  const { data: intradayData, isLoading: intradayLoading } = useQuery<AnalyticsIntradayResponse>({
    queryKey: ['analytics-intraday', itemId, selectedDate],
    queryFn: () => layoutApi.getAnalyticsIntraday(itemId, selectedDate!).then((r) => r.data as AnalyticsIntradayResponse),
    enabled: level === 'intraday' && selectedDate !== null,
  });

  // Handlers
  const handleYearClick = (data: any) => {
    if (data && data.activePayload) {
      const year = data.activePayload[0].payload.year;
      setSelectedYear(year);
      setLevel('monthly');
    }
  };

  const handleMonthClick = (data: any) => {
    if (data && data.activePayload) {
      const month = data.activePayload[0].payload.month;
      setSelectedMonth(month);
      setLevel('daily');
    }
  };

  const handleDayClick = (data: any) => {
    if (data && data.activePayload) {
      const date = data.activePayload[0].payload.date;
      setSelectedDate(date);
      setLevel('intraday');
    }
  };

  const formatHrs = (val: number) => {
    const hrs = Math.floor(val);
    const mins = Math.round((val - hrs) * 60);
    if (hrs === 0 && mins === 0) return '0m';
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  const handleExportPdf = () => {
    const opts: PdfReportOptions = {
      title: 'Uptime Analytics Report',
      subtitle: `System: ${hostname}`,
      meta: [
        `Report Level: ${level.charAt(0).toUpperCase() + level.slice(1)}`,
      ],
      fileName: `uptime-analytics-${hostname}-${level}.pdf`,
      tables: [],
    };

    if (level === 'yearly' && yearlyData?.years) {
      opts.tables.push({
        title: 'Yearly Uptime Summary',
        columns: [
          { header: 'Year', key: 'year' },
          { header: 'Avg Daily Uptime', key: 'avg_daily_hours', align: 'right' },
        ],
        rows: yearlyData.years.map(y => ({
          year: y.year,
          avg_daily_hours: formatHrs(y.avg_daily_hours),
        })),
      });
    } else if (level === 'monthly' && monthlyData?.months) {
      if (selectedYear) opts.meta?.push(`Year: ${selectedYear}`);
      opts.tables.push({
        title: `Monthly Uptime Summary (${selectedYear})`,
        columns: [
          { header: 'Month', key: 'month_label' },
          { header: 'Avg Daily Uptime', key: 'avg_daily_hours', align: 'right' },
        ],
        rows: monthlyData.months.map(m => ({
          month_label: m.month_label,
          avg_daily_hours: formatHrs(m.avg_daily_hours),
        })),
      });
    } else if (level === 'daily' && dailyData?.days) {
      const monthName = new Date(selectedYear!, selectedMonth! - 1, 1).toLocaleString('default', { month: 'long' });
      if (selectedYear && selectedMonth) opts.meta?.push(`Period: ${monthName} ${selectedYear}`);
      opts.tables.push({
        title: `Daily Uptime Summary (${monthName} ${selectedYear})`,
        columns: [
          { header: 'Day', key: 'day' },
          { header: 'Total Uptime', key: 'total_hours', align: 'right' },
          { header: 'Boot Sessions', key: 'boot_sessions', align: 'right' },
        ],
        rows: dailyData.days.map(d => ({
          day: d.day,
          total_hours: formatHrs(d.total_hours),
          boot_sessions: d.boot_sessions,
        })),
      });
    } else if (level === 'intraday' && intradayData?.timeline) {
      if (selectedDate) opts.meta?.push(`Date: ${selectedDate}`);
      opts.tables.push({
        title: `Intraday Activity (${selectedDate})`,
        columns: [
          { header: 'Session Start', key: 'start' },
          { header: 'Session End', key: 'end' },
          { header: 'Duration', key: 'duration', align: 'right' },
          { header: 'Boot Time', key: 'boot_time' },
        ],
        rows: intradayData.timeline.map(t => {
          const durationHrs = (t.end - t.start) / 3600;
          return {
            start: new Date(t.start * 1000).toLocaleTimeString(),
            end: new Date(t.end * 1000).toLocaleTimeString(),
            duration: formatHrs(durationHrs),
            boot_time: new Date(t.boot_time * 1000).toLocaleString(),
          };
        }),
      });
    }

    generatePdfReport(opts);
  };

  const renderBreadcrumbs = () => {
    return (
      <div className="flex items-center space-x-2 text-sm font-medium mb-6 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-4">
        <button 
          onClick={() => setLevel('yearly')} 
          className={`hover:text-indigo-600 transition-colors ${level === 'yearly' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}`}
        >
          All Years
        </button>
        
        {selectedYear && (
          <>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <button 
              onClick={() => { setLevel('monthly'); }}
              className={`hover:text-indigo-600 transition-colors ${level === 'monthly' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}`}
            >
              {selectedYear}
            </button>
          </>
        )}

        {selectedMonth && selectedYear && (level === 'daily' || level === 'intraday') && (
          <>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <button 
              onClick={() => { setLevel('daily'); }}
              className={`hover:text-indigo-600 transition-colors ${level === 'daily' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}`}
            >
              {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'long' })}
            </button>
          </>
        )}

        {selectedDate && level === 'intraday' && (
          <>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
              {new Date(selectedDate).getDate()}
            </span>
          </>
        )}
      </div>
    );
  };

  // Timeline rendering for intraday
  const renderIntradayTimeline = () => {
    if (intradayLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    
    const blocks = intradayData?.timeline || [];
    if (blocks.length === 0) {
      return <div className="text-center p-12 text-slate-500">No telemetry data recorded for {selectedDate}</div>;
    }

    const startOfDay = new Date(selectedDate + 'T00:00:00').getTime();
    const endOfDay = new Date(selectedDate + 'T23:59:59').getTime();
    const dayDuration = endOfDay - startOfDay;

    return (
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-indigo-500" />
          24-Hour Activity Timeline
        </h4>
        
        <div className="relative w-full mt-4">
          {/* Labels above the timeline (in document flow) */}
          <div className="relative h-6 w-full pointer-events-none">
            {[0, 6, 12, 18, 24].map((hr) => (
              <span 
                key={hr} 
                className="absolute bottom-1 text-xs text-slate-500 font-medium -translate-x-1/2"
                style={{ left: `${(hr / 24) * 100}%` }}
              >
                {hr === 0 ? '12 AM' : hr === 12 ? '12 PM' : hr > 12 ? `${hr-12} PM` : `${hr} AM`}
              </span>
            ))}
          </div>

          <div className="relative h-24 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {/* Hour markers (grid lines) */}
            <div className="absolute inset-0 w-full h-full pointer-events-none z-10">
              {[0, 6, 12, 18, 24].map((hr) => (
                <div 
                  key={hr} 
                  className="absolute top-0 bottom-0 border-l border-slate-300 dark:border-slate-600"
                  style={{ left: `${(hr / 24) * 100}%` }}
                />
              ))}
            </div>
          
          {/* Online Blocks */}
          {blocks.map((b, i) => {
            const leftPct = Math.max(0, ((b.start * 1000 - startOfDay) / dayDuration) * 100);
            const widthPct = Math.min(100 - leftPct, (((b.end - b.start) * 1000) / dayDuration) * 100);
            return (
              <div
                key={i}
                className={`absolute top-0 bottom-0 bg-emerald-500 opacity-80 border-r border-emerald-600 hover:opacity-100 transition-opacity group cursor-pointer ${
                  leftPct < 0.5 ? 'rounded-l-lg' : ''
                } ${leftPct + widthPct > 99.5 ? 'rounded-r-lg' : ''}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              >
                <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                  {new Date(b.start * 1000).toLocaleTimeString()} - {new Date(b.end * 1000).toLocaleTimeString()}
                  <br />
                  <span className="text-slate-400">Boot: {new Date(b.boot_time * 1000).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
          </div>
        </div>
        
        <div className="flex gap-4 text-sm pt-4">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> Online</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-300"></div> Offline / No Data</div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          {level !== 'yearly' && (
            <button 
              onClick={() => {
                if (level === 'intraday') setLevel('daily');
                else if (level === 'daily') setLevel('monthly');
                else if (level === 'monthly') setLevel('yearly');
              }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
          )}
          Uptime Analytics <span className="text-slate-400 font-normal text-lg">/ {hostname}</span>
        </h2>
        <button
          onClick={handleExportPdf}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-300"
        >
          <FileDown className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      {renderBreadcrumbs()}

      <div className="flex-1 min-h-[400px]">
        {/* YEARLY */}
        {level === 'yearly' && (
          <>
            {yearLoading ? <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div> : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={yearlyData?.years || []} onClick={handleYearClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{fill: '#64748b'}} />
                  <YAxis tickFormatter={formatHrs} tickLine={false} axisLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip 
                    cursor={{fill: 'rgba(99, 102, 241, 0.1)'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [formatHrs(val), 'Avg Daily Uptime']}
                    labelFormatter={(label) => `Year ${label}`}
                  />
                  <Bar dataKey="avg_daily_hours" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {/* MONTHLY */}
        {level === 'monthly' && (
          <>
            {monthLoading ? <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div> : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={monthlyData?.months || []} onClick={handleMonthClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="month_label" tickLine={false} axisLine={false} tick={{fill: '#64748b'}} />
                  <YAxis tickFormatter={formatHrs} tickLine={false} axisLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip 
                    cursor={{fill: 'rgba(16, 185, 129, 0.1)'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [formatHrs(val), 'Avg Daily Uptime']}
                    labelFormatter={(label) => `${label} ${selectedYear}`}
                  />
                  <Bar dataKey="avg_daily_hours" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {/* DAILY */}
        {level === 'daily' && (
          <>
            {dayLoading ? <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div> : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dailyData?.days || []} onClick={handleDayClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fill: '#64748b'}} />
                  <YAxis tickFormatter={formatHrs} tickLine={false} axisLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip 
                    cursor={{fill: 'rgba(14, 165, 233, 0.1)'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number, name: string, props: any) => [formatHrs(val), `Total Uptime (${props.payload.boot_sessions} boot sessions)`]}
                    labelFormatter={(label) => `Date: ${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(label).padStart(2, '0')}`}
                  />
                  <ReferenceLine y={24} stroke="#cbd5e1" strokeDasharray="3 3" />
                  <Bar dataKey="total_hours" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {/* INTRADAY */}
        {level === 'intraday' && renderIntradayTimeline()}
      </div>
    </div>
  );
}
