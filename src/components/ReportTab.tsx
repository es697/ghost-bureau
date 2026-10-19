import type { MatchResult, UnassignedReason } from '../engine/match';
import { REASON_LABELS, type PlaceStatus, type Report } from '../engine/report';
import type { BureauData } from '../engine/types';
import { GhostAvatar } from './GhostAvatar';
import { Empty, Meter } from './ui';

const STATUS_LABEL: Record<PlaceStatus, string> = {
  overloaded: 'Over capacity',
  full: 'Full',
  ok: 'Has space',
  empty: 'Empty',
  closed: 'Closed',
};

export function ReportTab({ data, report, result }: { data: BureauData; report: Report; result: MatchResult }) {
  if (report.total === 0) {
    return (
      <Empty icon="📭" title="The report is empty">
        <p>Add at least one request and a relocation summary will appear here.</p>
      </Empty>
    );
  }
  if (report.pending === report.total) {
    return (
      <Empty icon="⏳" title="Assignment has not run yet">
        <p>All {report.total} requests are new. Press "Assign automatically" in the "Assignments" tab and a summary will appear here.</p>
      </Empty>
    );
  }
  const ghost = new Map(data.ghosts.map((g) => [g.id, g]));
  const place = new Map(data.places.map((p) => [p.id, p]));
  const pct = Math.round((report.settled / report.total) * 100);
  const reasons = (Object.keys(report.byReason) as UnassignedReason[]).filter((r) => report.byReason[r] > 0);
  const overloaded = report.places.filter((p) => p.status === 'overloaded');
  const inDemand = report.places.filter((p) => p.status !== 'overloaded' && p.topChoiceFor > p.capacity);

  return (
    <section className="report">
      <div className="kpis">
        <div className="kpi panel">
          <span className="kpi-label">Requests</span>
          <span className="kpi-value">{report.total}</span>
        </div>
        <div className="kpi panel kpi-good">
          <span className="kpi-label">Assigned</span>
          <span className="kpi-value">{report.settled}</span>
          <span className="kpi-sub">{pct}%</span>
        </div>
        <div className={`kpi panel ${report.unsettled ? 'kpi-bad' : ''}`}>
          <span className="kpi-label">Needs your decision</span>
          <span className="kpi-value">{report.unsettled}</span>
        </div>
        {report.pending > 0 && (
          <div className="kpi panel kpi-warn">
            <span className="kpi-label">New, not processed</span>
            <span className="kpi-value">{report.pending}</span>
          </div>
        )}
        <div className={`kpi panel ${report.manualWithWarnings ? 'kpi-warn' : ''}`}>
          <span className="kpi-label">Manual decisions</span>
          <span className="kpi-value">{report.manual}</span>
          <span className="kpi-sub">with problems: {report.manualWithWarnings}</span>
        </div>
      </div>

      <div className="report-grid">
        <div className="panel pad">
          <h3>☠️ Most problematic requests</h3>
          {report.problems.length === 0 ? (
            <p className="muted">No problematic requests — everyone is happy and calm.</p>
          ) : (
            <ol className="problems">
              {report.problems.slice(0, 5).map((p) => {
                const g = ghost.get(p.ghostId)!;
                const a = result.assignments[p.ghostId];
                return (
                  <li key={p.ghostId}>
                    <GhostAvatar ghost={g} size={32} />
                    <div>
                    <div className="problem-head">
                      <b>{g.name}</b>
                      <span className="muted">
                        {a.placeId ? `→ ${place.get(a.placeId)!.name}` : a.mode === 'pending' ? 'not processed' : 'no place'}
                      </span>
                    </div>
                    <span className="problem-reasons">{p.reasons.join(' · ')}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {reasons.length > 0 && (
            <>
              <h4>Why they were left without a place</h4>
              <ul className="reason-list">
                {reasons.map((r) => (
                  <li key={r}>
                    {REASON_LABELS[r]}: <b>{report.byReason[r]}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="panel pad">
          <h3>🏚️ Place load</h3>
          {overloaded.length > 0 ? (
            <p className="alert alert-bad">
              Over capacity:{' '}
              <b>{overloaded.map((s) => `${place.get(s.placeId)!.name} (${s.occupants}/${s.capacity})`).join(', ')}</b>
            </p>
          ) : (
            <p className="muted">No places are over capacity.</p>
          )}
          {inDemand.length > 0 && (
            <p className="alert alert-warn">
              Demand exceeds capacity (best choice for more requests than there are seats):{' '}
              <b>{inDemand.map((s) => place.get(s.placeId)!.name).join(', ')}</b>
            </p>
          )}
          <ul className="loads">
            {report.places.map((l) => {
              const p = place.get(l.placeId)!;
              return (
                <li key={l.placeId}>
                  <div className="load-head">
                    <span>
                      {p.emoji} {p.name}
                    </span>
                    <span className={`status-pill pill-${l.status}`}>{STATUS_LABEL[l.status]}</span>
                  </div>
                  <Meter value={l.occupants} max={l.capacity} danger={l.status === 'overloaded'} />
                  <div className="load-sub muted">
                    {l.occupants}/{l.capacity} · suits {l.demand} requests · best choice for {l.topChoiceFor}
                    {l.topChoiceFor > l.capacity && <span className="text-warn"> — demand exceeds capacity</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
