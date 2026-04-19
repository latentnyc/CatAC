// CatCard.jsx — a single cat in the party column
const STATS = ["str","dex","con","int","wis","cha"];
const STAT_LABELS = { str:"STR",dex:"DEX",con:"CON",int:"INT",wis:"WIS",cha:"CHA" };
const NEIGHBORHOODS_MINI = { park:{icon:"🌳"}, lake:{icon:"🌊"}, rooftops:{icon:"🌆"}, bakery:{icon:"🔥"} };
const SLOTS = ["collar","toy","treat","relic"];

function CatCard({ cat, onEquipClick, onRetire }) {
  return (
    <div className={"cat-card" + (cat.status === "mission" ? " busy" : "")}>
      <window.CatPortrait palette={cat.palette} classIcon={cat.classIcon} onMission={cat.status === "mission"} />
      <div className="cat-head">
        <div className="cat-head-text">
          <span className="cat-name">{cat.name}{cat.veteran ? " ✨" : ""}</span>
          <span className="cat-class">{cat.classLabel} · {cat.breedName} — {cat.passiveLabel}</span>
        </div>
        <div className="cat-head-actions">
          {cat.pendingChoice ? <button className="stat-choice-btn" title="Stat choice">★</button> : null}
          <button className="retire-btn" onClick={onRetire} title="Retire to the Cat Lounge">🏡</button>
        </div>
      </div>
      <div className="cat-level-row">
        <span className="cat-level">Lv {cat.level}</span>
        <div className="xp-bar"><div className="xp-fill" style={{ width: cat.xpPct + "%" }}/></div>
      </div>
      <div className="stats-grid">
        {STATS.map(s => {
          const base = cat.baseStats[s], eff = cat.stats[s];
          const bonus = eff - base;
          return (
            <div className="stat" key={s}>
              <span className="stat-label">{STAT_LABELS[s]}</span>
              <span className="stat-value">{eff}{bonus > 0 && <span className="stat-bonus">+{bonus}</span>}</span>
            </div>
          );
        })}
      </div>
      <div className="equip-row">
        {SLOTS.map(slot => {
          const item = cat.equipped[slot];
          if (!item) return <div className="equip-slot empty" key={slot}>{slot[0].toUpperCase()}</div>;
          const hood = NEIGHBORHOODS_MINI[item.affinity];
          return (
            <div key={slot}
                 className={`equip-slot rarity-${item.rarity}`}
                 title={item.name}
                 onClick={() => onEquipClick && onEquipClick(item)}>
              {hood?.icon || ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
window.CatCard = CatCard;
window.STATS = STATS;
window.STAT_LABELS = STAT_LABELS;
