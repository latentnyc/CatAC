// MissionCard.jsx — one tier row in the neighborhood list
function MissionCard({ tier, duration, dc, partyRange, rewards, unlocked, unlockReq, onPlan }) {
  return (
    <div className={"mission-card" + (unlocked ? "" : " locked")}>
      <div className="mission-row">
        <div className="mission-head">
          <span className="mission-tier">T{tier}</span>
          <span className="mission-duration">{duration}</span>
        </div>
        <div className="mission-stats">
          <span>DC {dc}</span>
          <span>Party {partyRange}</span>
          <span>{rewards}</span>
        </div>
        <button className="mission-send" disabled={!unlocked} onClick={onPlan}>Plan</button>
      </div>
      {!unlocked && <div className="mission-lock">{unlockReq}</div>}
    </div>
  );
}
window.MissionCard = MissionCard;

// NeighborhoodTabs.jsx
const HOODS = [
  { id:"park",     name:"The Park",     icon:"🌳", color:"#6fb86b", flavor:"Shady oaks, bold squirrels, muddy paws.", checks:"STR / CON" },
  { id:"lake",     name:"The Lake",     icon:"🌊", color:"#57a8d3", flavor:"Quiet docks, koi drifting in lantern light.", checks:"INT / WIS" },
  { id:"rooftops", name:"The Rooftops", icon:"🌆", color:"#b89ce8", flavor:"Starlight, chimney pots, daring leaps.", checks:"DEX / CHA" },
  { id:"bakery",   name:"The Bakery",   icon:"🔥", color:"#e89660", flavor:"Warm ovens, tempting scraps, bold mice.", checks:"STR / DEX" },
];
function NeighborhoodTabs({ active, onChange }) {
  return (
    <div id="neighborhood-tabs">
      {HOODS.map(h => (
        <button key={h.id}
                className={"hood-tab" + (active === h.id ? " active" : "")}
                style={{ "--hood-color": h.color }}
                onClick={() => onChange(h.id)}>
          <span className="hood-icon">{h.icon}</span>
          <span className="hood-name">{h.name}</span>
        </button>
      ))}
    </div>
  );
}
window.HOODS = HOODS;
window.NeighborhoodTabs = NeighborhoodTabs;
