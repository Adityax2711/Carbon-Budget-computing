import React, { useState } from 'react';
import { AuditLogItem } from '../../types';
import { Shield, Search, ChevronDown, ChevronRight } from 'lucide-react';

interface AuditTableProps {
  logs: AuditLogItem[];
}

export const AuditTable: React.FC<AuditTableProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.actor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionBadge = (action: string) => {
    if (action.includes('PAUSE') || action.includes('DEPLETED')) {
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    }
    if (action.includes('RESUME') || action.includes('ACTIVE') || action.includes('REGISTERED')) {
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    }
    if (action.includes('OVERRIDE') || action.includes('THROTTLE')) {
      return 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30';
    }
    if (action.includes('DUPLICATE') || action.includes('SUPPRESSED')) {
      return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
    }
    return 'bg-slate-500/15 text-slate-300 border border-slate-500/30';
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-[#273449]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#8B7CFF]" />
            Immutable Audit Trail & Policy Log
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Every policy decision, telemetry deduplication event, and manual override is recorded with actor metadata.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search actions or actors..."
            className="w-full bg-[#0F172A] border border-[#273449] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#8B7CFF]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#273449] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="pb-3 pl-2">Timestamp (UTC)</th>
              <th className="pb-3">Action</th>
              <th className="pb-3">Actor</th>
              <th className="pb-3">Justification / Reason</th>
              <th className="pb-3 pr-2 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#273449]/50">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  No audit entries found matching filter.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-[#131F32]/50 transition">
                      <td className="py-3 pl-2 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getActionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300 font-medium">
                        {log.actor}
                      </td>
                      <td className="py-3 text-slate-400 max-w-xs truncate">
                        {log.reason || '—'}
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-[#8B7CFF] hover:text-[#7A6AE6] text-xs font-semibold inline-flex items-center gap-1"
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          JSON
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#0A0F1D]/80">
                        <td colSpan={5} className="p-3">
                          <pre className="text-[11px] font-mono text-emerald-400 bg-[#070B14] p-3 rounded-lg border border-[#273449] overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
