// Panels.jsx — shop, inventory, active-missions, log, toast stack
function ShopItem({ icon, name, desc, cost, state, disabled, onBuy }) {
  return (
    <div className={"shop-item" + (disabled ? " disabled" : "")}>
      <div className="shop-icon">{icon}</div>
      <div className="shop-info">
        <div className="shop-name">{name}</div>
        <div className="shop-desc">{desc}</div>
        {state && <div className="shop-state">{state}</div>}
      </div>
      <button className="shop-buy" disabled={disabled} onClick={onBuy}>{cost}</button>
    </div>
  );
}

function InventoryItem({ item, onClick }) {
  const hood = { park:"🌳", lake:"🌊", rooftops:"🌆", bakery:"🔥" }[item.affinity];
  return (
    <div className={`inv-item rarity-${item.rarity}${item.equipped ? " equipped" : ""}`} onClick={onClick}>
      <div className="inv-type">{item.type} · {hood}</div>
      <div className="inv-name">{item.name}</div>
      <div className="inv-bonus">{item.bonus}</div>
      {item.equipped && <div className="inv-flag">Equipped</div>}
    </div>
  );
}

function ActiveMissionRow({ party, hoodIcon, hoodColor, tier, hoodName, pct, eta }) {
  return (
    <div className="active-row">
      <div className="active-party">{party}</div>
      <div className="active-mission" style={{ "--hood-color": hoodColor }}>{hoodIcon} T{tier} {hoodName}</div>
      <div className="active-bar"><div className="active-fill" style={{ width: pct + "%" }}/></div>
      <div className="active-eta">{eta}</div>
    </div>
  );
}

function LogEntry({ time, msg }) {
  return <div className="log-entry"><span className="log-time">{time}</span> {msg}</div>;
}

function Toast({ outcome, zone, body, rewards, hazard }) {
  const icon = outcome === "crit" ? "⭐" : outcome === "success" ? "✅" : "⚠️";
  return (
    <div className={`toast toast-${outcome} visible`}>
      <div className="toast-head">
        <span className="toast-outcome">{icon} {outcome.toUpperCase()}</span>
        <span className="toast-zone">{zone}</span>
      </div>
      <div className="toast-body">{body}</div>
      <div className="toast-rewards">{rewards}</div>
      {hazard && <div className="toast-hazard">{hazard}</div>}
    </div>
  );
}

Object.assign(window, { ShopItem, InventoryItem, ActiveMissionRow, LogEntry, Toast });
