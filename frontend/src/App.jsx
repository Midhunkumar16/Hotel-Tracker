import { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL = 30000;
const BACKEND_URL = "https://hotel-tracker-hw3k.onrender.com";

const RADIUS_OPTIONS = [
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "50 km", value: 50000 },
];

function StarRow({ count }) {
  const full = Math.round(count);
  return (
    <span style={{ color: "#f5c842", letterSpacing: 1, fontSize: 13 }}>
      {"★".repeat(full)}{"☆".repeat(5 - full)}
    </span>
  );
}

function TrendBadge({ trend, diff }) {
  if (!trend) return null;
  const up = trend === "up";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
      background: up ? "rgba(255,80,80,0.13)" : "rgba(40,200,120,0.13)",
      color: up ? "#ff5050" : "#28c878",
      border: `1px solid ${up ? "rgba(255,80,80,0.3)" : "rgba(40,200,120,0.3)"}`,
      animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      {up ? "▲" : "▼"} ${Math.abs(diff)}
    </span>
  );
}

function Alert({ alert, onDismiss }) {
  const up = alert.trend === "up";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", borderRadius: 12,
      background: up ? "rgba(255,80,80,0.08)" : "rgba(40,200,120,0.08)",
      border: `1px solid ${up ? "rgba(255,80,80,0.25)" : "rgba(40,200,120,0.25)"}`,
      animation: "slideDown 0.4s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#e8e8e8" }}>{alert.name}</div>
        <div style={{ fontSize: 12, color: up ? "#ff7070" : "#28c878", marginTop: 2 }}>
          {up ? "Price increased" : "Price dropped"} from <b>${alert.prevPrice}</b> → <b>${alert.newPrice}</b>
        </div>
      </div>
      <button onClick={() => onDismiss(alert.id)} style={{
        background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16,
      }}>×</button>
    </div>
  );
}

function HotelCard({ hotel, flash }) {
  const up = hotel.trend === "up";
  return (
    <div style={{
      background: flash
        ? (up ? "rgba(255,80,80,0.07)" : "rgba(40,200,120,0.07)")
        : "rgba(255,255,255,0.04)",
      border: flash
        ? `1px solid ${up ? "rgba(255,80,80,0.3)" : "rgba(40,200,120,0.3)"}`
        : "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "20px 22px",
      transition: "background 0.6s ease, border 0.6s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, marginRight: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#f0f0f0", marginBottom: 4 }}>
            {hotel.name}
          </div>
          <StarRow count={hotel.rating} />
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>📍 {hotel.distance_km} km away</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{hotel.address}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
            {hotel.user_ratings_total?.toLocaleString()} reviews
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "'DM Mono', monospace" }}>
            ${hotel.estimated_price_usd}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 5 }}>est. per night</div>
          {hotel.trend && (
            <TrendBadge trend={hotel.trend} diff={hotel.estimated_price_usd - (hotel.prevPrice || hotel.estimated_price_usd)} />
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{
      padding: "12px 16px", borderRadius: 10, marginBottom: 16,
      background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)",
      color: "#ff7070", fontSize: 13,
    }}>
      ⚠️ {message}
    </div>
  );
}

export default function HotelTracker() {
  const [hotels, setHotels] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [flashIds, setFlashIds] = useState(new Set());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000);
  const [location, setLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState("Detecting location...");
  const [sortBy, setSortBy] = useState("distance");
  const [radius, setRadius] = useState(5000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false); // OFF by default
  const alertIdRef = useRef(0);
  const prevPricesRef = useRef({});
  const locationRef = useRef(null);
  const radiusRef = useRef(5000);

  // Keep refs in sync so interval always uses latest values
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { radiusRef.current = radius; }, [radius]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ lat: 40.7128, lng: -74.006 });
      setLocationLabel("New York City, NY (default)");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLocation({ lat, lng });
        setLocationLabel(`${lat.toFixed(4)}°N, ${Math.abs(lng).toFixed(4)}°W`);
      },
      () => {
        setLocation({ lat: 40.7128, lng: -74.006 });
        setLocationLabel("New York City, NY (default)");
      }
    );
  }, []);

  const fetchHotels = useCallback(async (coords, radiusMeters) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/hotels/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=${radiusMeters}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch hotels");
      }
      const data = await res.json();

      setHotels(() => {
        const newFlash = new Set();
        const newAlerts = [];

        const updated = data.hotels.map((hotel) => {
          const prevPrice = prevPricesRef.current[hotel.id];
          const diff = prevPrice ? hotel.estimated_price_usd - prevPrice : 0;
          const changed = prevPrice && Math.abs(diff) >= 5;
          const trend = changed ? (diff > 0 ? "up" : "down") : null;

          if (changed) {
            newFlash.add(hotel.id);
            newAlerts.push({
              id: ++alertIdRef.current,
              name: hotel.name,
              prevPrice,
              newPrice: hotel.estimated_price_usd,
              trend,
            });
          }

          prevPricesRef.current[hotel.id] = hotel.estimated_price_usd;
          return { ...hotel, trend, prevPrice: prevPrice || null };
        });

        if (newFlash.size > 0) {
          setFlashIds(newFlash);
          setTimeout(() => setFlashIds(new Set()), 2000);
          setAlerts((a) => [...newAlerts, ...a].slice(0, 6));
        }

        return updated;
      });

      setLastUpdated(new Date());
      setCountdown(POLL_INTERVAL / 1000);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch when location is ready
  useEffect(() => {
    if (!location) return;
    fetchHotels(location, radius);
  }, [location]); // only on first location detect

  // Re-fetch when radius changes
  useEffect(() => {
    if (!location) return;
    prevPricesRef.current = {};
    fetchHotels(location, radius);
  }, [radius]);

  // Auto-refresh interval — only runs when autoRefresh is ON
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (locationRef.current) fetchHotels(locationRef.current, radiusRef.current);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHotels]);

  // Countdown ticker — only ticks when auto-refresh is ON
  useEffect(() => {
    if (!autoRefresh) { setCountdown(POLL_INTERVAL / 1000); return; }
    const tick = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, [autoRefresh]);

  // Reset countdown when a fetch completes
  useEffect(() => {
    if (lastUpdated) setCountdown(POLL_INTERVAL / 1000);
  }, [lastUpdated]);

  const handleManualRefresh = () => {
    if (!location || loading) return;
    fetchHotels(location, radius);
  };

  const sorted = [...hotels].sort((a, b) => {
    if (sortBy === "distance") return a.distance_km - b.distance_km;
    if (sortBy === "price-asc") return a.estimated_price_usd - b.estimated_price_usd;
    if (sortBy === "price-desc") return b.estimated_price_usd - a.estimated_price_usd;
    if (sortBy === "stars") return b.rating - a.rating;
    return 0;
  });

  const filterBtnStyle = (active) => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    cursor: "pointer", transition: "all 0.2s",
    border: active ? "1px solid #5b6aff" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(91,106,255,0.15)" : "rgba(255,255,255,0.04)",
    color: active ? "#8090ff" : "#888",
  });

  const radiusBtnStyle = (active) => ({
    padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
    cursor: "pointer", transition: "all 0.2s",
    border: active ? "1px solid #f5c842" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(245,200,66,0.12)" : "rgba(255,255,255,0.04)",
    color: active ? "#f5c842" : "#888",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d10; }
        @keyframes popIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        .inspect-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .inspect-btn:active { transform: translateY(0px); }
        .toggle-btn:hover { opacity: 0.85; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0d0d10 0%, #111118 100%)",
        fontFamily: "'DM Sans', sans-serif",
        color: "#e8e8e8",
        padding: "32px 20px",
        maxWidth: 680,
        margin: "0 auto",
      }}>

        {/* Header */}
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: autoRefresh ? "#28c878" : "#555",
                animation: autoRefresh ? "pulse 2s infinite" : "none",
                transition: "background 0.3s",
              }} />
              <span style={{
                fontSize: 12, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase",
                color: autoRefresh ? "#28c878" : "#555", transition: "color 0.3s",
              }}>
                {autoRefresh ? "Live Monitoring" : "Monitoring Paused"}
              </span>
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: -1 }}>
              Hotel Rate<br /><span style={{ color: "#5b6aff" }}>Tracker</span>
            </h1>
            <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>📍 {locationLabel}</div>
          </div>

          {/* Inspect + Auto-refresh controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", marginTop: 4 }}>
            {/* Inspect button */}
            <button
              className="inspect-btn"
              onClick={handleManualRefresh}
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 16px", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
                background: "rgba(91,106,255,0.15)", border: "1px solid rgba(91,106,255,0.4)",
                color: "#8090ff", fontSize: 13, fontWeight: 700,
                transition: "all 0.2s", opacity: loading ? 0.5 : 1,
              }}
            >
              <span style={{
                display: "inline-block",
                animation: loading ? "spin 0.8s linear infinite" : "none",
                fontSize: 15,
              }}>
                {loading ? "⟳" : "🔍"}
              </span>
              {loading ? "Fetching..." : "Inspect"}
            </button>

            {/* Auto-refresh toggle */}
            <button
              className="toggle-btn"
              onClick={() => setAutoRefresh((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 16px", borderRadius: 10, cursor: "pointer",
                background: autoRefresh ? "rgba(40,200,120,0.12)" : "rgba(255,255,255,0.04)",
                border: autoRefresh ? "1px solid rgba(40,200,120,0.35)" : "1px solid rgba(255,255,255,0.1)",
                color: autoRefresh ? "#28c878" : "#666",
                fontSize: 13, fontWeight: 700, transition: "all 0.3s",
              }}
            >
              {/* Toggle pill */}
              <div style={{
                width: 32, height: 18, borderRadius: 9,
                background: autoRefresh ? "#28c878" : "#333",
                position: "relative", transition: "background 0.3s", flexShrink: 0,
              }}>
                <div style={{
                  position: "absolute", top: 3, left: autoRefresh ? 17 : 3,
                  width: 12, height: 12, borderRadius: "50%", background: "#fff",
                  transition: "left 0.3s",
                }} />
              </div>
              Auto-refresh
            </button>
          </div>
        </div>

        {/* Radius selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#555", textTransform: "uppercase", marginBottom: 8 }}>
            🔭 Search Radius
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {RADIUS_OPTIONS.map(({ label, value }) => (
              <button key={value} onClick={() => setRadius(value)} style={radiusBtnStyle(radius === value)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Status bar */}
        {lastUpdated && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20, fontSize: 12,
          }}>
            <span style={{ color: "#666" }}>
              {hotels.length} hotel{hotels.length !== 1 ? "s" : ""} · Updated {lastUpdated.toLocaleTimeString()}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {autoRefresh ? (
                <>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: countdown < 5 ? "#f5c842" : "#28c878", animation: "pulse 1.5s infinite" }} />
                  <span style={{ color: "#888" }}>Next refresh in <b style={{ color: "#ccc" }}>{countdown}s</b></span>
                </>
              ) : (
                <span style={{ color: "#555", fontStyle: "italic" }}>Auto-refresh off</span>
              )}
            </div>
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
            <div style={{
              width: 32, height: 32, border: "3px solid #222", borderTop: "3px solid #5b6aff",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            Searching within {RADIUS_OPTIONS.find(r => r.value === radius)?.label}...
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#555", textTransform: "uppercase", marginBottom: 10 }}>
              🔔 Price Alerts
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.map((a) => (
                <Alert key={a.id} alert={a} onDismiss={(id) => setAlerts((prev) => prev.filter((x) => x.id !== id))} />
              ))}
            </div>
          </div>
        )}

        {/* Sort controls */}
        {!loading && hotels.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { key: "distance", label: "📍 Nearest" },
              { key: "price-asc", label: "💰 Cheapest" },
              { key: "price-desc", label: "💎 Luxury" },
              { key: "stars", label: "⭐ Top Rated" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setSortBy(key)} style={filterBtnStyle(sortBy === key)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Hotel cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} flash={flashIds.has(hotel.id)} />
          ))}
        </div>

        {!loading && hotels.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
            No hotels found within {RADIUS_OPTIONS.find(r => r.value === radius)?.label}. Try a wider range.
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: "#444" }}>
          Real data via Google Places API · {autoRefresh ? "Auto-refreshing every 30s" : "Manual refresh mode"}
        </div>
      </div>
    </>
  );
}