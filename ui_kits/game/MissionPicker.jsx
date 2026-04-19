// MissionPicker.jsx — the send-party modal
function MissionPicker({ hood, tier, cats, selected, onToggle, partyMax, onCancel, onStart }) {
  const selectedList = [...selected];
  // Fake score calc for the kit — real logic lives in CatGame/js/game.js
  const score = selectedList.reduce((s,id) => {
    const c = cats.find(x => x.id === id);
    return s + (c ? c.checkTotal : 0);
  }, 0);
  const dc = hood.dc;
  const margin = selectedList.length ? score - dc : null;
  const verdict = !selectedList.length ? "pick a cat"
    : margin >= 6 ? "likely crit" : margin >= 0 ? "favored" : margin >= -4 ? "risky" : "doomed";

  return (
    <div id="modal" className="open">
      <div id="modal-box">
        <div id="modal-body">
          <h3>{hood.icon} T{tier} {hood.name}</h3>
          <p className="muted">Check: {hood.checks} · Duration {hood.duration} · Party 1–{partyMax}</p>
          <div className="picker-scoreboard">
            <span>Party score: <strong>{score}</strong> vs DC <strong>{dc}</strong></span>
            <span className={"picker-verdict verdict-" + verdict.replace(/\s+/g, "-")}>{verdict}</span>
          </div>
          <div className="picker-passives">
            <span className="pass-chip pass-mit">⚔ +2 mitigation</span>
            <span className="pass-chip pass-loot">✿ +3% loot</span>
          </div>
          <div className="picker-hazards">
            <div className="picker-hazards-head">
              <span>Hazards @ {hood.icon} {hood.name}</span>
              <span className="muted">Mitigation: 4 / 13</span>
            </div>
            {hood.hazards.map(h => (
              <div key={h.name} className={"hazard-row " + h.cls}>
                <span className="hazard-name">{h.name}</span>
                <span className="hazard-desc">{h.desc}</span>
                <span className="hazard-value">{h.value}</span>
              </div>
            ))}
          </div>
          <div className="picker-list">
            {cats.map(c => {
              const sel = selected.has(c.id);
              const disabled = !sel && selected.size >= partyMax;
              return (
                <label key={c.id} className={"picker-cat" + (sel ? " selected" : "") + (disabled ? " disabled" : "")}>
                  <input type="checkbox" checked={sel} disabled={disabled} onChange={() => onToggle(c.id)}/>
                  <span className="picker-name">{c.name} · {c.classLabel} Lv{c.level}</span>
                  <span className="picker-score">{c.scoreLabel} ({c.checkTotal})</span>
                </label>
              );
            })}
          </div>
          <div className="modal-actions">
            <button onClick={onCancel}>Cancel</button>
            <button className="btn-primary" disabled={!selectedList.length} onClick={onStart}>Send party</button>
          </div>
        </div>
      </div>
    </div>
  );
}
window.MissionPicker = MissionPicker;
