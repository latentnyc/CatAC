// TopBar.jsx — fixed top bar: brand + resources + save indicator
function TopBar({ resources }) {
  return (
    <header id="top-bar">
      <div className="brand">
        <img src="../../assets/paw-logo.svg" className="brand-mark" width="28" height="28" alt="paw" />
        <span className="brand-title">Cat Adventure Club</span>
      </div>
      <div className="resources">
        <span className="res-gold" title="Moneys">💰 <span>{resources.gold}</span></span>
        <span className="res-fish" title="Fishes">🐟 <span>{resources.fishes}</span></span>
        <span className="res-treaty" title="Treaties">🎀 <span>{resources.treaties}</span></span>
        <span className="res-9lives" title="Nine Lives">🌀 <span>{resources.nineLives}</span></span>
        <span className="res-cats" title="Club">🐈 <span>{resources.catCount}/{resources.catCap}</span></span>
      </div>
      <div className="top-actions">
        <span id="save-indicator" className="active" title="Saved">●</span>
      </div>
    </header>
  );
}
window.TopBar = TopBar;
