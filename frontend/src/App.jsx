import { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL = 30000;
const BACKEND_URL = "https://hotel-tracker-hw3k.onrender.com";
const ROOM_TYPES = ["single", "double", "twin", "suite", "family"];
const ROOM_LABELS = { single: "Single", double: "Double", twin: "Twin", suite: "Suite", family: "Family" };
const RADIUS_OPTIONS = [
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "50 km", value: 50000 },
];

function StarRow({ count }) {
  const full = Math.round(count || 0);
  return <span style={{ color: "#f5c842", fontSize: 13 }}>{"★".repeat(full)}{"☆".repeat(5 - full)}</span>;
}

function ErrorBanner({ message }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", color: "#ff7070", fontSize: 13 }}>
      ⚠️ {message}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  color: "#f0f0f0", fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none",
};
const labelStyle = { fontSize: 12, fontWeight: 700, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, display: "block" };

// ── Hotel Setup ───────────────────────────────────────────────────────────────
function HotelSetup({ onSave }) {
  const [form, setForm] = useState({
    name: "", address: "", lat: "", lng: "", star_rating: 4,
    room_rates: { single: "", double: "", twin: "", suite: "", family: "" }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [detecting, setDetecting] = useState(false);

  const detectLocation = () => {
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })); setDetecting(false); },
      () => setDetecting(false)
    );
  };

  const handleSave = async () => {
    if (!form.name || !form.lat || !form.lng) { setError("Name and location are required"); return; }
    for (const r of ROOM_TYPES) {
      if (!form.room_rates[r] || isNaN(form.room_rates[r])) { setError(`Please enter a valid rate for ${ROOM_LABELS[r]} room`); return; }
    }
    setSaving(true);
    try {
      const payload = { ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng), star_rating: parseInt(form.star_rating), room_rates: Object.fromEntries(ROOM_TYPES.map(r => [r, parseFloat(form.room_rates[r])])) };
      const res = await fetch(`${BACKEND_URL}/my-hotel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Failed to save hotel");
      const data = await res.json();
      onSave(data.hotel);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0d0d10, #111118)", fontFamily: "'DM Sans', sans-serif", color: "#e8e8e8", padding: "40px 20px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: "#5b6aff", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Setup</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: -1, lineHeight: 1.1 }}>
            Set Up Your<br /><span style={{ color: "#5b6aff" }}>Hotel Profile</span>
          </h1>
          <p style={{ marginTop: 12, color: "#666", fontSize: 14 }}>Your property becomes the reference point. We'll compare every competitor's rates against yours.</p>
        </div>
        {error && <ErrorBanner message={error} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div><label style={labelStyle}>Hotel Name</label><input style={inputStyle} placeholder="e.g. Grand Markham Hotel" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label style={labelStyle}>Address</label><input style={inputStyle} placeholder="Full address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div>
            <label style={labelStyle}>Location (Lat / Lng)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Latitude" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Longitude" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
              <button onClick={detectLocation} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(91,106,255,0.4)", background: "rgba(91,106,255,0.12)", color: "#8090ff", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{detecting ? "..." : "📍 Detect"}</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Star Rating</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, star_rating: s }))} style={{ flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer", fontSize: 18, border: form.star_rating >= s ? "1px solid #f5c842" : "1px solid rgba(255,255,255,0.1)", background: form.star_rating >= s ? "rgba(245,200,66,0.12)" : "rgba(255,255,255,0.04)" }}>★</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Your Room Rates (USD per night)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ROOM_TYPES.map(room => (
                <div key={room} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 70, fontSize: 13, color: "#aaa", fontWeight: 600 }}>{ROOM_LABELS[room]}</span>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#666", fontSize: 14 }}>$</span>
                    <input style={{ ...inputStyle, paddingLeft: 24 }} placeholder="0" type="number" value={form.room_rates[room]} onChange={e => setForm(f => ({ ...f, room_rates: { ...f.room_rates, [room]: e.target.value } }))} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ padding: "14px", borderRadius: 10, border: "none", background: saving ? "#333" : "linear-gradient(135deg, #5b6aff, #4f46e5)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", marginTop: 8 }}>
            {saving ? "Saving..." : "Save Hotel & Start Tracking →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Search Bar ────────────────────────────────────────────────────────────────
function HotelSearchBar({ myRates, onPin, pinnedIds }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [pinning, setPinning] = useState({});
  const debounceRef = useRef(null);

  const search = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true); setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) { setError(e.message); }
    finally { setSearching(false); }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 600);
  };

  const handlePin = async (hotel) => {
    setPinning(p => ({ ...p, [hotel.id]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/pinned-competitors`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_id: hotel.id }),
      });
      if (!res.ok) throw new Error("Failed to pin");
      const data = await res.json();
      onPin(data.hotel);
    } catch (e) { setError(e.message); }
    finally { setPinning(p => ({ ...p, [hotel.id]: false })); }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
        🔍 Search & Add Competitor
      </div>
      <div style={{ position: "relative" }}>
        <input
          style={{ ...inputStyle, paddingRight: 44, borderColor: "rgba(91,106,255,0.3)" }}
          placeholder="Search any hotel worldwide... e.g. Marriott Toronto"
          value={query}
          onChange={handleChange}
        />
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, opacity: 0.4 }}>
          {searching ? "⟳" : "🔍"}
        </span>
      </div>

      {error && <div style={{ color: "#ff7070", fontSize: 12, marginTop: 6 }}>⚠️ {error}</div>}

      {results.length > 0 && (
        <div style={{ marginTop: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
          {results.map((hotel, i) => {
            const isPinned = pinnedIds.has(hotel.id);
            return (
              <div key={hotel.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: isPinned ? "rgba(40,200,120,0.05)" : "transparent" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#f0f0f0" }}>{hotel.name}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{hotel.address}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                    <StarRow count={hotel.rating} />
                    <span style={{ fontSize: 11, color: "#555" }}>{hotel.user_ratings_total?.toLocaleString()} reviews</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#8090ff", fontFamily: "DM Mono, monospace" }}>${hotel.estimated_price_usd}/night</span>
                  </div>
                </div>
                <button
                  onClick={() => !isPinned && handlePin(hotel)}
                  disabled={pinning[hotel.id] || isPinned}
                  style={{
                    padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
                    cursor: isPinned ? "default" : "pointer",
                    background: isPinned ? "rgba(40,200,120,0.15)" : "rgba(91,106,255,0.15)",
                    color: isPinned ? "#28c878" : "#8090ff",
                  }}
                >
                  {pinning[hotel.id] ? "Adding..." : isPinned ? "✓ Pinned" : "+ Add"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {query && !searching && results.length === 0 && (
        <div style={{ marginTop: 8, color: "#555", fontSize: 13, textAlign: "center", padding: "16px" }}>No hotels found for "{query}"</div>
      )}
    </div>
  );
}

// ── Competitor Row ────────────────────────────────────────────────────────────
function CompetitorRow({ hotel, expanded, onToggle, onUnpin, pinned }) {
  const isWorse  = (room) => hotel.rate_comparison?.[room]?.status === "cheaper";
  const isBetter = (room) => hotel.rate_comparison?.[room]?.status === "expensive";
  const worseCount  = ROOM_TYPES.filter(isWorse).length;
  const betterCount = ROOM_TYPES.filter(isBetter).length;

  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer", background: expanded ? "rgba(91,106,255,0.07)" : "transparent" }}>
        <td style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {pinned && <span style={{ fontSize: 10, fontWeight: 700, color: "#28c878", background: "rgba(40,200,120,0.15)", padding: "2px 6px", borderRadius: 6 }}>PINNED</span>}
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#f0f0f0" }}>{hotel.name}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>📍 {hotel.distance_km} km · {hotel.address}</div>
              <StarRow count={hotel.rating} />
            </div>
          </div>
        </td>
        <td style={{ padding: "14px 16px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace" }}>${hotel.estimated_price_usd}</div>
          <div style={{ fontSize: 11, color: "#555" }}>avg/night</div>
        </td>
        <td style={{ padding: "14px 16px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {worseCount > 0 && <div style={{ fontSize: 12, color: "#ff5050", fontWeight: 700 }}>⚠️ {worseCount} room{worseCount > 1 ? "s" : ""} cheaper</div>}
          {betterCount > 0 && <div style={{ fontSize: 12, color: "#28c878", fontWeight: 700 }}>✓ {betterCount} room{betterCount > 1 ? "s" : ""} pricier</div>}
        </td>
        <td style={{ padding: "14px 16px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#555" }}>{expanded ? "▲" : "▼"}</span>
            {pinned && (
              <button onClick={e => { e.stopPropagation(); onUnpin(hotel.id); }} style={{ fontSize: 10, color: "#ff5050", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}>
                Unpin
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && hotel.rate_comparison && (
        <tr>
          <td colSpan={4} style={{ padding: 0, background: "rgba(0,0,0,0.3)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  <th style={{ padding: "8px 16px", fontSize: 11, color: "#555", fontWeight: 700, textAlign: "left", textTransform: "uppercase", letterSpacing: 1 }}>Room Type</th>
                  <th style={{ padding: "8px 12px", fontSize: 11, color: "#5b6aff", fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>Your Rate</th>
                  <th style={{ padding: "8px 12px", fontSize: 11, color: "#f5c842", fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>Booking.com</th>
                  <th style={{ padding: "8px 12px", fontSize: 11, color: "#888", fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>Difference</th>
                </tr>
              </thead>
              <tbody>
                {ROOM_TYPES.map(room => {
                  const cmp = hotel.rate_comparison[room];
                  const worse  = cmp.status === "cheaper";
                  const better = cmp.status === "expensive";
                  return (
                    <tr key={room} style={{ background: worse ? "rgba(255,80,80,0.04)" : better ? "rgba(40,200,120,0.04)" : "transparent" }}>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "#ccc", fontWeight: 600 }}>{ROOM_LABELS[room]}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14, fontWeight: 700, color: "#8090ff", fontFamily: "'DM Mono', monospace" }}>${cmp.my_rate}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14, fontWeight: 700, color: "#f5c842", fontFamily: "'DM Mono', monospace" }}>${cmp.competitor_rate}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {cmp.status === "same"
                          ? <span style={{ color: "#555", fontSize: 12 }}>—</span>
                          : <span style={{ fontSize: 13, fontWeight: 700, color: worse ? "#ff5050" : "#28c878" }}>
                              {worse ? "▼" : "▲"} ${Math.abs(cmp.diff)} {worse ? "they're cheaper" : "you're pricier"}
                            </span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: "8px 16px", fontSize: 11, color: "#444", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              📊 Source: Booking.com (simulated) · Updates on each Inspect
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function HotelTracker() {
  const [myHotel, setMyHotel] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [pinnedCompetitors, setPinnedCompetitors] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000);
  const [sortBy, setSortBy] = useState("distance");
  const [radius, setRadius] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [activeTab, setActiveTab] = useState("nearby"); // "nearby" | "pinned"
  const radiusRef = useRef(5000);

  useEffect(() => { radiusRef.current = radius; }, [radius]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/my-hotel`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setMyHotel(data); setSetupDone(true); } setCheckingSetup(false); })
      .catch(() => setCheckingSetup(false));
  }, []);

  const fetchCompetitors = useCallback(async (radiusMeters) => {
    if (!myHotel) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/competitors?lat=${myHotel.lat}&lng=${myHotel.lng}&radius=${radiusMeters}`);
      if (!res.ok) throw new Error("Failed to fetch competitors");
      const data = await res.json();
      setCompetitors(data.competitors || []);
      setLastUpdated(new Date());
      setCountdown(POLL_INTERVAL / 1000);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [myHotel]);

  const fetchPinned = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/pinned-competitors`);
      const data = await res.json();
      setPinnedCompetitors(data.pinned || []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!setupDone || !myHotel) return;
    fetchCompetitors(radius);
    fetchPinned();
  }, [setupDone, myHotel]);

  useEffect(() => {
    if (!autoRefresh || !setupDone) return;
    const interval = setInterval(() => {
      fetchCompetitors(radiusRef.current);
      fetchPinned();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, setupDone]);

  useEffect(() => {
    if (!autoRefresh) { setCountdown(POLL_INTERVAL / 1000); return; }
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, [autoRefresh]);

  useEffect(() => { if (lastUpdated) setCountdown(POLL_INTERVAL / 1000); }, [lastUpdated]);

  const handlePin = (hotel) => {
    setPinnedCompetitors(prev => {
      if (prev.find(p => p.id === hotel.id)) return prev;
      return [...prev, hotel];
    });
    setActiveTab("pinned");
  };

  const handleUnpin = async (placeId) => {
    await fetch(`${BACKEND_URL}/pinned-competitors/${placeId}`, { method: "DELETE" });
    setPinnedCompetitors(prev => prev.filter(p => p.id !== placeId));
  };

  const pinnedIds = new Set(pinnedCompetitors.map(p => p.id));

  const sorted = [...competitors].sort((a, b) => {
    if (sortBy === "distance") return a.distance_km - b.distance_km;
    if (sortBy === "price-asc") return a.estimated_price_usd - b.estimated_price_usd;
    if (sortBy === "price-desc") return b.estimated_price_usd - a.estimated_price_usd;
    if (sortBy === "stars") return b.rating - a.rating;
    return 0;
  });

  const btnStyle = (active, color = "#5b6aff", bg = "rgba(91,106,255,0.15)") => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    cursor: "pointer", transition: "all 0.2s",
    border: active ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.1)",
    background: active ? bg : "rgba(255,255,255,0.04)",
    color: active ? color : "#888",
  });

  if (checkingSetup) return (
    <div style={{ minHeight: "100vh", background: "#0d0d10", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#555", fontFamily: "DM Sans, sans-serif" }}>Loading...</div>
    </div>
  );

  if (!setupDone) return <HotelSetup onSave={hotel => { setMyHotel(hotel); setSetupDone(true); }} />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d10; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0d0d10, #111118)", fontFamily: "'DM Sans', sans-serif", color: "#e8e8e8", padding: "28px 20px", maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: autoRefresh ? "#28c878" : "#555", animation: autoRefresh ? "pulse 2s infinite" : "none" }} />
              <span style={{ fontSize: 11, color: autoRefresh ? "#28c878" : "#555", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                {autoRefresh ? "Live Monitoring" : "Monitoring Paused"}
              </span>
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>
              {myHotel.name} <span style={{ color: "#5b6aff" }}>Rate Tracker</span>
            </h1>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>📍 {myHotel.address} · {"★".repeat(myHotel.star_rating)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <button onClick={() => { fetchCompetitors(radius); fetchPinned(); }} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, background: "rgba(91,106,255,0.15)", border: "1px solid rgba(91,106,255,0.4)", color: "#8090ff", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
              <span style={{ animation: loading ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>{loading ? "⟳" : "🔍"}</span>
              {loading ? "Fetching..." : "Inspect"}
            </button>
            <button onClick={() => setAutoRefresh(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: autoRefresh ? "rgba(40,200,120,0.12)" : "rgba(255,255,255,0.04)", border: autoRefresh ? "1px solid rgba(40,200,120,0.35)" : "1px solid rgba(255,255,255,0.1)", color: autoRefresh ? "#28c878" : "#666", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <div style={{ width: 30, height: 17, borderRadius: 9, background: autoRefresh ? "#28c878" : "#333", position: "relative" }}>
                <div style={{ position: "absolute", top: 3, left: autoRefresh ? 15 : 3, width: 11, height: 11, borderRadius: "50%", background: "#fff", transition: "left 0.3s" }} />
              </div>
              Auto-refresh
            </button>
            <button onClick={() => setSetupDone(false)} style={{ fontSize: 12, color: "#555", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Edit my hotel</button>
          </div>
        </div>

        {/* My Rates Bar */}
        <div style={{ background: "rgba(91,106,255,0.08)", border: "1px solid rgba(91,106,255,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5b6aff", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>My Room Rates</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {ROOM_TYPES.map(room => (
              <div key={room} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>{ROOM_LABELS[room]}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#8090ff", fontFamily: "'DM Mono', monospace" }}>${myHotel.room_rates[room]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Search */}
        <HotelSearchBar myRates={myHotel.room_rates} onPin={handlePin} pinnedIds={pinnedIds} />

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setActiveTab("nearby")} style={btnStyle(activeTab === "nearby")}>
            📍 Nearby Competitors {competitors.length > 0 && `(${competitors.length})`}
          </button>
          <button onClick={() => setActiveTab("pinned")} style={btnStyle(activeTab === "pinned", "#28c878", "rgba(40,200,120,0.12)")}>
            📌 Pinned {pinnedCompetitors.length > 0 && `(${pinnedCompetitors.length})`}
          </button>
        </div>

        {/* Nearby Controls */}
        {activeTab === "nearby" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {RADIUS_OPTIONS.map(({ label, value }) => (
                <button key={value} onClick={() => { setRadius(value); fetchCompetitors(value); }} style={btnStyle(radius === value, "#f5c842", "rgba(245,200,66,0.12)")}>{label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ key: "distance", label: "📍 Nearest" }, { key: "price-asc", label: "💰 Cheapest" }, { key: "price-desc", label: "💎 Luxury" }, { key: "stars", label: "⭐ Top Rated" }].map(({ key, label }) => (
                <button key={key} onClick={() => setSortBy(key)} style={btnStyle(sortBy === key)}>{label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Status bar */}
        {lastUpdated && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20, fontSize: 12 }}>
            <span style={{ color: "#666" }}>
              {activeTab === "nearby" ? `${competitors.length} competitors` : `${pinnedCompetitors.length} pinned`} · Updated {lastUpdated.toLocaleTimeString()}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {autoRefresh
                ? <><div style={{ width: 6, height: 6, borderRadius: "50%", background: countdown < 5 ? "#f5c842" : "#28c878", animation: "pulse 1.5s infinite" }} /><span style={{ color: "#888" }}>Next refresh in <b style={{ color: "#ccc" }}>{countdown}s</b></span></>
                : <span style={{ color: "#555", fontStyle: "italic" }}>Auto-refresh off</span>
              }
            </div>
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #222", borderTop: "3px solid #5b6aff", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            Fetching competitor rates...
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
            {activeTab === "pinned" && pinnedCompetitors.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#555" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📌</div>
                <div style={{ fontSize: 14, color: "#666" }}>No pinned competitors yet</div>
                <div style={{ fontSize: 12, color: "#444", marginTop: 6 }}>Use the search bar above to find and pin hotels from anywhere in the world</div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Hotel</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Avg Rate</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Rate Alert</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === "nearby" ? sorted : pinnedCompetitors).map(hotel => (
                    <CompetitorRow
                      key={hotel.id}
                      hotel={hotel}
                      expanded={expandedId === hotel.id}
                      onToggle={() => setExpandedId(expandedId === hotel.id ? null : hotel.id)}
                      onUnpin={handleUnpin}
                      pinned={pinnedIds.has(hotel.id) || activeTab === "pinned"}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && activeTab === "nearby" && sorted.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>No competitors found. Try a wider radius.</div>
        )}

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#333" }}>
          Booking.com rates are simulated · Real API integration ready on key approval
        </div>
      </div>
    </>
  );
}
