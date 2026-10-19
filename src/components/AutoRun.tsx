import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';

/**
 * The "Assigning requests…" window in the spirit of copying files in Windows 95:
 * a ghost flies from the old house to the new one, and the progress bar fills up per request.
 * The assignment itself is instant — the animation is there so the operator can see the bureau did something.
 */
export function AutoRunProgress({ names, onDone }: { names: string[]; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const delay = reduce ? 30 : Math.max(120, Math.min(300, 1800 / Math.max(1, names.length)));
    if (step >= names.length) {
      const t = setTimeout(() => doneRef.current(), reduce ? 0 : 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [step, names.length]);

  const pct = names.length ? Math.round((step / names.length) * 100) : 100;
  const current = names[Math.min(step, names.length - 1)];

  return (
    <div className="modal-backdrop">
      <div className="modal window modal-small" role="dialog" aria-modal="true" aria-label="Assigning requests" aria-busy="true">
        <div className="titlebar">
          <span className="titlebar-text">Assigning requests…</span>
        </div>
        <div className="modal-body">
          <div className="haunt-anim" aria-hidden>
            <span>🏚️</span>
            <span className="haunt-ghost">👻</span>
            <span>🏰</span>
          </div>
          <p className="haunt-current" aria-live="polite">
            {step < names.length ? (
              <>
                Finding a place for: <b>{current}</b>
              </>
            ) : (
              <b>Done</b>
            )}
          </p>
          <div className="meter">
            <div className="meter-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="muted haunt-count">
            {Math.min(step, names.length)} of {names.length}
          </p>
        </div>
      </div>
    </div>
  );
}

export interface AutoRunSummary {
  total: number;
  settled: number;
  needDecision: number;
  /** Previously assigned ghosts that were displaced by more urgent new requests */
  displaced: string[];
}

/** The result of the assignment — a Win95 message box */
export function AutoRunResult({ summary, onClose }: { summary: AutoRunSummary; onClose: () => void }) {
  const { total, settled, needDecision, displaced } = summary;
  return (
    <Modal title="Assignment complete" onClose={onClose} small>
      <div className="msgbox">
        <div className="msgbox-icon" aria-hidden>
          <span className="msgbox-info">i</span>
        </div>
        <div>
          <p className="msgbox-text">
            Assigned automatically: {settled} of {total}.
          </p>
          <p className="msgbox-detail">
            {needDecision > 0
              ? `Requests that need your decision: ${needDecision}. Each one shows the reason and what you can do.`
              : 'Every request got a place. The reasoning is in the "Assigned" list.'}
          </p>
          {displaced.length > 0 && (
            <p className="msgbox-detail">
              More urgent new requests took their places, and these were left without one: <b>{displaced.join(', ')}</b>.
            </p>
          )}
        </div>
      </div>
      <div className="msgbox-actions">
        <button className="btn btn-primary" onClick={onClose} data-autofocus>
          {needDecision > 0 ? 'Go to them' : 'OK'}
        </button>
      </div>
    </Modal>
  );
}
