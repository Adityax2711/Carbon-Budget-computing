import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { TelemetryRecord, BudgetItem } from '../../types';
import { Activity, Flame } from 'lucide-react';

interface BurnRateChartProps {
  telemetry: TelemetryRecord[];
  budget: BudgetItem | null;
}

export const BurnRateChart: React.FC<BurnRateChartProps> = ({ telemetry, budget }) => {
  // Format telemetry chronologically (earliest to latest)
  const chartData = [...telemetry].reverse().map((item, idx) => {
    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return {
      index: idx + 1,
      time,
      energy_wh: item.energy_wh,
      carbon_g: item.carbon_g,
      intensity: item.carbon_intensity,
      region: item.region
    };
  });

  const limit = budget?.limit_gco2e || 150;
  const warningThreshold = limit * 0.8;

  return (
    <div className="glass-panel p-6 rounded-2xl border border-[#273449]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#8B7CFF]" />
            <h3 className="text-base font-semibold text-white">Live Emissions & Energy Telemetry</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time energy consumption (Wh) translated to emissions (gCO₂e) against allowance thresholds.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B7CFF]" />
            <span className="text-slate-300 font-medium">Emissions (gCO₂e)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-300 font-medium">80% Warning ({warningThreshold.toFixed(0)}g)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-300 font-medium">100% Limit ({limit.toFixed(0)}g)</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Flame className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
            <p className="text-sm font-medium">Awaiting telemetry telemetry stream...</p>
            <p className="text-xs text-slate-500 mt-1">Start the simulation or inject a power spike below.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="carbonGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B7CFF" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#8B7CFF" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="time" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#33435C',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  color: '#F8FAFC',
                  fontSize: '12px'
                }}
              />
              <ReferenceLine y={warningThreshold} stroke="#FBBF24" strokeDasharray="4 4" label={{ value: '80% Warn', fill: '#FBBF24', fontSize: 10, position: 'insideRight' }} />
              <ReferenceLine y={limit} stroke="#F87171" strokeDasharray="4 4" label={{ value: '100% Deplete', fill: '#F87171', fontSize: 10, position: 'insideRight' }} />
              <Area
                type="monotone"
                dataKey="carbon_g"
                name="Emissions (gCO₂e)"
                stroke="#8B7CFF"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#carbonGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
