import { WORKLOG, isTodo, type Prompt, type Stamped } from '../data/worklog';

const Txt = ({ s }: { s: string }) => <span className={isTodo(s) ? 'todo' : ''}>{s}</span>;

const Stamp = ({ at }: { at?: string }) => (at ? <time className="stamp">{at}</time> : null);

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="panel pad">
      <h3>{title}</h3>
      <ul>
        {items.map((s) => (
          <li key={s}>
            <Txt s={s} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StampedList({ title, items }: { title: string; items: Stamped[] }) {
  return (
    <div className="panel pad">
      <h3>{title}</h3>
      <ul className="stamped">
        {items.map((it) => (
          <li key={it.text}>
            <Stamp at={it.at} /> <Txt s={it.text} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorklogTab() {
  return (
    <section className="worklog">
      <div className="kpis">
        <div className="kpi panel">
          <span className="kpi-label">Tools</span>
          <span className="kpi-text">{WORKLOG.tools.join(', ')}</span>
        </div>
        <div className="kpi panel">
          <span className="kpi-label">Time · {WORKLOG.date}</span>
          <span className="kpi-text">
            <Txt s={WORKLOG.totalTime} />
          </span>
        </div>
        <div className="kpi panel">
          <span className="kpi-label">Tokens</span>
          <span className="kpi-text">
            <Txt s={WORKLOG.tokens} />
          </span>
        </div>
      </div>

      <ul className="highlights">
        {WORKLOG.highlights.map((h) => (
          <li key={h}>✔ {h}</li>
        ))}
      </ul>

      <h3 className="section-title">Stages of the work</h3>
      <ol className="stages">
        {WORKLOG.stages.map((st) => (
          <li key={st.title} className="panel pad">
            <h4>
              {st.title} <Stamp at={st.time} />
            </h4>
            <div className="stage-cols">
              <div>
                <span className="who">Me</span>
                <p>
                  <Txt s={st.me} />
                </p>
              </div>
              <div>
                <span className="who who-ai">AI</span>
                <p>
                  <Txt s={st.ai} />
                </p>
              </div>
            </div>
            <div className="prompts">
              {st.prompts.map((p: Prompt) => (
                <div key={p.text} className="prompt">
                  <code>
                    <Stamp at={p.at} />
                    <Txt s={p.text} />
                  </code>
                  {p.result && <div className="prompt-result">→ {p.result}</div>}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="panel pad checklist">
        <h3>
          ✅ Pre-submission checklist <Stamp at={WORKLOG.checklist.at} />
        </h3>
        <p className="muted">{WORKLOG.checklist.note}</p>
        <ul>
          {WORKLOG.checklist.items.map((item) => (
            <li key={item}>
              <span className="check-mark" aria-hidden>
                ☑
              </span>{' '}
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="report-grid">
        <StampedList title="🧠 Decisions I made myself" items={WORKLOG.myDecisions} />
        <StampedList title="🐛 Where the AI got it wrong" items={WORKLOG.aiMistakes} />
        <List title="✍️ What I rewrote by hand" items={WORKLOG.manualChanges} />
        <List title="🔮 What to improve in a real product" items={WORKLOG.improvements} />
      </div>
    </section>
  );
}
