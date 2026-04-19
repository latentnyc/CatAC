// App.jsx — Cat Adventure Club UI kit click-thru demo
const { useState, useMemo } = React;

const FAKE_CATS = [
  { id:"c1", name:"Basil",    breedName:"Tabby",        classLabel:"Scrapper", classIcon:"⚔", passiveLabel:"Bulwark",  level:14, xpPct:72, baseStats:{str:9,dex:6,con:10,int:4,wis:5,cha:6}, stats:{str:11,dex:7,con:12,int:4,wis:5,cha:7}, palette:{fur:"#c9a76a",accent:"#f3d9a8",eyes:"#3e8a59"}, status:"idle", pendingChoice:true, veteran:true, checkTotal:28, scoreLabel:"STR+CON" },
  { id:"c2", name:"Juniper",  breedName:"Siamese",      classLabel:"Mystic",   classIcon:"✿", passiveLabel:"Fortune",  level:9,  xpPct:40, baseStats:{str:5,dex:6,con:5,int:10,wis:9,cha:8}, stats:{str:5,dex:7,con:5,int:12,wis:10,cha:9}, palette:{fur:"#e8ddc8",accent:"#8a6a48",eyes:"#4a9cd6"}, status:"mission", equipped:{ collar:{name:"Mystic Collar",affinity:"lake",rarity:"epic"} }, checkTotal:22, scoreLabel:"INT+WIS" },
  { id:"c3", name:"Pip",      breedName:"Bombay",       classLabel:"Prowler",  classIcon:"✶", passiveLabel:"Fleet",    level:11, xpPct:18, baseStats:{str:6,dex:10,con:6,int:6,wis:5,cha:9}, stats:{str:6,dex:13,con:6,int:6,wis:5,cha:11}, palette:{fur:"#1e1e22",accent:"#3a3a42",eyes:"#d9c566"}, status:"idle", checkTotal:26, scoreLabel:"DEX+CHA" },
  { id:"c4", name:"Clover",   breedName:"Calico",       classLabel:"Purrist",  classIcon:"✚", passiveLabel:"Guardian", level:7,  xpPct:55, baseStats:{str:6,dex:5,con:7,int:8,wis:10,cha:7}, stats:{str:6,dex:5,con:8,int:8,wis:11,cha:7}, palette:{fur:"#f0e4d4",accent:"#d97a5a",eyes:"#65a85f"}, status:"idle", checkTotal:19, scoreLabel:"WIS+CHA" },
  { id:"c5", name:"Miso",     breedName:"Russian Blue", classLabel:"Prowler",  classIcon:"✶", passiveLabel:"Fleet",    level:5,  xpPct:28, baseStats:{str:5,dex:9,con:6,int:6,wis:6,cha:7}, stats:{str:5,dex:10,con:6,int:6,wis:6,cha:8}, palette:{fur:"#7e8998",accent:"#b0bac5",eyes:"#5db891"}, status:"idle", checkTotal:18, scoreLabel:"DEX+CHA" },
];

const FAKE_INVENTORY = [
  { id:"i1", type:"collar", name:"Bramble Collar",   affinity:"park",     rarity:"rare",      bonus:"+2 CON, +1 STR" },
  { id:"i2", type:"toy",    name:"Kelp Fetch",       affinity:"lake",     rarity:"epic",      bonus:"+3 INT, +2 WIS", equipped:true },
  { id:"i3", type:"relic",  name:"Moon Bell",        affinity:"rooftops", rarity:"legendary", bonus:"+4 DEX, +3 CHA" },
  { id:"i4", type:"treat",  name:"Scorched Sardine", affinity:"bakery",   rarity:"common",    bonus:"+1 STR" },
  { id:"i5", type:"collar", name:"Lantern Collar",   affinity:"lake",     rarity:"rare",      bonus:"+2 INT" },
  { id:"i6", type:"toy",    name:"Acorn Ball",       affinity:"park",     rarity:"common",    bonus:"+1 CON" },
];

const HOOD_TIERS = [
  { tier:1, duration:"1m",     dc:10, partyRange:"1", rewards:"+12💰 +8xp",        unlocked:true },
  { tier:2, duration:"3m",     dc:18, partyRange:"1–2", rewards:"+30💰 +1🐟 +20xp", unlocked:true },
  { tier:3, duration:"10m",    dc:28, partyRange:"1–2", rewards:"+80💰 +2🐟 +40xp", unlocked:true },
  { tier:4, duration:"30m",    dc:40, partyRange:"1–3", rewards:"+200💰 +4🐟 +80xp",unlocked:true },
  { tier:5, duration:"1h 30m", dc:54, partyRange:"1–3", rewards:"+500💰 +1🎀 +160xp", unlocked:false, unlockReq:"Unlocks at Club 8 cats." },
  { tier:6, duration:"4h",     dc:72, partyRange:"2–4", rewards:"+1200💰 +3🎀 +320xp", unlocked:false, unlockReq:"Unlocks at Club 12 cats." },
];

const HOOD_DEFS = {
  park:     { icon:"🌳", name:"The Park",     color:"#6fb86b", checks:"STR / CON", duration:"10m", dc:28,
              hazards:[
                { name:"Bold Squirrels",   desc:"Harry the party, siphoning focus.",             value:"severity 4", cls:"minor" },
                { name:"Canopy Watcher",   desc:"Something old watches from the canopy.",       value:"severity 6", cls:"major" },
              ]},
  lake:     { icon:"🌊", name:"The Lake",     color:"#57a8d3", checks:"INT / WIS", duration:"10m", dc:30,
              hazards:[
                { name:"Slippery Docks",   desc:"Wet planks, hurried paws.",                     value:"severity 3", cls:"minor" },
                { name:"Reed Memory",      desc:"Something in the reeds remembers you.",         value:"severity 7", cls:"major" },
              ]},
  rooftops: { icon:"🌆", name:"The Rooftops", color:"#b89ce8", checks:"DEX / CHA", duration:"12m", dc:32,
              hazards:[
                { name:"Chimney Gust",     desc:"Sudden updrafts, long falls.",                  value:"severity 5", cls:"minor" },
              ]},
  bakery:   { icon:"🔥", name:"The Bakery",   color:"#e89660", checks:"STR / DEX", duration:"14m", dc:34,
              hazards:[
                { name:"Oven Flares",      desc:"Bursts of heat from the back of the shop.",     value:"severity 4", cls:"minor" },
                { name:"Broom With Intent",desc:"A broom has your name on it.",                  value:"severity 5", cls:"major" },
              ]},
};

function App() {
  const [hood, setHood] = useState("park");
  const [invFilter, setInvFilter] = useState("all");
  const [picker, setPicker] = useState(null); // { hoodId, tier, selected: Set }
  const [resources, setResources] = useState({ gold:3420, fishes:47, treaties:8, nineLives:3, catCount:5, catCap:16 });
  const [toasts, setToasts] = useState([
    { id:1, outcome:"crit",    zone:"🌊 T3 The Lake",     body:"Juniper struck a crit!",                    rewards:"+240💰 +6🐟 +120xp",   hazard:null },
    { id:2, outcome:"success", zone:"🌳 T2 The Park",     body:"Party slipped past the squirrels.",         rewards:"+60💰 +2🐟 +40xp",     hazard:null },
    { id:3, outcome:"fail",    zone:"🔥 T4 The Bakery",   body:"Too much heat. Pip retreated.",             rewards:"+0💰",                  hazard:"Oven Flares clipped the party." },
  ]);

  const openPicker = (tier) => setPicker({ hoodId: hood, tier, selected: new Set() });
  const togglePick = (id) => {
    setPicker(p => {
      const s = new Set(p.selected);
      s.has(id) ? s.delete(id) : s.add(id);
      return { ...p, selected: s };
    });
  };
  const startMission = () => {
    // fake: close, push a toast
    setPicker(null);
    const id = Date.now();
    setToasts(t => [{ id, outcome:"success", zone:"🐾 Sent", body:"Party dispatched.", rewards:"Running…" }, ...t].slice(0, 5));
  };

  const retire = (catId) => {
    setToasts(t => [{ id: Date.now(), outcome:"success", zone:"🏡 Lounge", body:"Cat retired to the lounge.", rewards:"+1 retirees" }, ...t].slice(0,5));
  };

  const invFiltered = useMemo(() => invFilter === "all" ? FAKE_INVENTORY : FAKE_INVENTORY.filter(i => i.rarity === invFilter), [invFilter]);

  const activeCats = FAKE_CATS.filter(c => c.status === "mission");
  const activePartyVisual = activeCats.map(c => c.name).join(", ") || "—";

  return (
    <React.Fragment>
      <window.TopBar resources={resources} />

      <div id="layout">
        {/* LEFT: Party + Shop */}
        <section id="party-col" className="col">
          <h2>The Club</h2>
          <div id="party-panel">
            {FAKE_CATS.map(cat => (
              <window.CatCard key={cat.id} cat={{ ...cat, equipped: cat.equipped || {} }} onRetire={() => retire(cat.id)} />
            ))}
          </div>

          <h2>Club Shop</h2>
          <div id="shop-panel">
            <window.ShopItem icon="🧹"   name="Sweep the Alley" desc="Clear your current mission log." cost="80💰" />
            <window.ShopItem icon="🥫"   name="Tuna Tin"        desc="+1 idle XP for every cat in the club." cost="45💰" />
            <window.ShopItem icon="🎲"   name="Lucky Charm"     desc="Single-use. Your next mission gets +25% stray-offer chance." cost="140💰" state="Ready" />
            <window.ShopItem icon="🍼"   name="Kitten Formula"  desc="Recruit one kitten (random class)." cost="1🎀" />
            <window.ShopItem icon="💤"   name="Cat Nap"         desc="Retire 15 cats, pick 1 to carry. Earn 🌀 Nine Lives." cost="15🐈" disabled state="Need 10 more cats" />
          </div>
        </section>

        {/* MIDDLE: Neighborhoods + Missions */}
        <section id="mission-col" className="col">
          <h2>Neighborhoods</h2>
          <window.NeighborhoodTabs active={hood} onChange={setHood} />
          <div className="hood-flavor">
            <span className="flavor-icon">{HOOD_DEFS[hood].icon}</span>
            <span className="flavor-text">
              {hood === "park"     && "Shady oaks, bold squirrels, muddy paws."}
              {hood === "lake"     && "Quiet docks, koi drifting in lantern light."}
              {hood === "rooftops" && "Starlight, chimney pots, daring leaps."}
              {hood === "bakery"   && "Warm ovens, tempting scraps, bold mice."}
            </span>
            <span className="flavor-checks">{HOOD_DEFS[hood].checks}</span>
          </div>
          <div id="mission-list">
            {HOOD_TIERS.map(t => (
              <window.MissionCard key={t.tier} {...t} onPlan={() => openPicker(t.tier)} />
            ))}
          </div>
        </section>

        {/* RIGHT: Inventory + Log */}
        <section id="right-col" className="col">
          <h2>Inventory</h2>
          <div className="inv-filter-row">
            {["all","common","rare","epic","legendary"].map(f => (
              <button key={f}
                className={"inv-filter-pill" + (invFilter === f ? " active rarity-" + f : "")}
                onClick={() => setInvFilter(f)}>{f}</button>
            ))}
          </div>
          <div id="inventory-panel">
            {invFiltered.map(i => <window.InventoryItem key={i.id} item={i} />)}
          </div>

          <h2>Mission Log</h2>
          <div id="log">
            <window.LogEntry time="21:04" msg="Juniper returned from 🌊 The Lake with a crit." />
            <window.LogEntry time="20:51" msg="Basil gained Lv 14. Stat choice available." />
            <window.LogEntry time="20:33" msg="Looted Moon Bell (legendary relic, 🌆 tag)." />
            <window.LogEntry time="19:59" msg="Pip retreated from 🔥 The Bakery. Oven Flares." />
          </div>
        </section>
      </div>

      {/* Active missions strip */}
      <div id="active-strip">
        <h2>Active Missions</h2>
        <window.ActiveMissionRow party={activePartyVisual} hoodIcon="🌊" hoodColor="#57a8d3" tier={3} hoodName="The Lake" pct={62} eta="3m 48s" />
      </div>

      {/* Toasts */}
      <div id="toast-stack">
        {toasts.map(t => <window.Toast key={t.id} {...t} />)}
      </div>

      {/* Picker modal */}
      {picker && (
        <window.MissionPicker
          hood={HOOD_DEFS[picker.hoodId]}
          tier={picker.tier}
          cats={FAKE_CATS.filter(c => c.status === "idle")}
          selected={picker.selected}
          onToggle={togglePick}
          partyMax={3}
          onCancel={() => setPicker(null)}
          onStart={startMission}
        />
      )}
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
