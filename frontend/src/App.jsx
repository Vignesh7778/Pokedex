import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;
const TYPE_COLORS = { normal: "#A8A878", fire: "#F08030", water: "#6890F0", electric: "#F8D030", grass: "#78C850", ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0", ground: "#E0C068", flying: "#A890F0", psychic: "#F85888", bug: "#A8B820", rock: "#B8A038", ghost: "#705898", dragon: "#7038F8", dark: "#705848", steel: "#B8B8D0", fairy: "#EE99AC" };
const STAT_LABELS = { hp: "HP", attack: "ATK", defense: "DEF", special_attack: "SP. ATK", special_defense: "SP. DEF", speed: "SPD" };

function titleCase(value) { return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
const TAMIL_TYPES = { normal: "சாதாரண", fire: "தீ", water: "நீர்", electric: "மின்சாரம்", grass: "புல்", ice: "பனி", fighting: "சண்டை", poison: "விஷம்", ground: "நிலம்", flying: "பறக்கும்", psychic: "மன சக்தி", bug: "பூச்சி", rock: "பாறை", ghost: "ஆவி", dragon: "டிராகன்", dark: "இருள்", steel: "எஃகு", fairy: "தேவதை" };
const TAMIL_ABILITIES = { static: "ஸ்டாட்டிக்", "lightning rod": "மின்னல் கம்பி", blaze: "பிளேஸ்", torrent: "டோரன்ட்", overgrow: "ஓவர்க்ரோ", intimidate: "இன்டிமிடேட்", levitate: "லெவிடேட்", pressure: "பிரஷர்", synchronize: "சின்க்ரனைஸ்" };
function voiceSummary(pokemon, language) {
  const types = pokemon.types.length > 1 ? `${pokemon.types.slice(0, -1).join(", ")} and ${pokemon.types.at(-1)}` : pokemon.types[0];
  const stats = pokemon.stats;
  if (language === "ta") {
    const tamilTypes = pokemon.types.map((type) => TAMIL_TYPES[type] || titleCase(type)).join(", ");
    const tamilAbilities = pokemon.abilities.map((ability) => TAMIL_ABILITIES[ability] || titleCase(ability)).join(", ");
    return `${titleCase(pokemon.name)} போகிமொன் எண் ${pokemon.id}. இது ${tamilTypes} வகை போகிமொன். இதன் உயரம் ${pokemon.height} மீட்டர் மற்றும் எடை ${pokemon.weight} கிலோகிராம். இதன் திறன்கள் ${tamilAbilities}. அடிப்படை புள்ளிவிவரங்கள்: ஹெச்.பி ${stats.hp}, தாக்குதல் ${stats.attack}, பாதுகாப்பு ${stats.defense}, சிறப்பு தாக்குதல் ${stats.special_attack}, சிறப்பு பாதுகாப்பு ${stats.special_defense}, வேகம் ${stats.speed}.`;
  }
  return `Here are the details for ${titleCase(pokemon.name)}. ${titleCase(pokemon.name)} is Pokémon number ${pokemon.id}. It has ${types} type${pokemon.types.length > 1 ? "s" : ""}. Its height is ${pokemon.height} meters and its weight is ${pokemon.weight} kilograms. Its abilities include ${pokemon.abilities.join(", ")}. Its base stats are HP ${stats.hp}, Attack ${stats.attack}, Defense ${stats.defense}, Special Attack ${stats.special_attack}, Special Defense ${stats.special_defense}, and Speed ${stats.speed}.`;
}

function App() {
  const [name, setName] = useState("");
  const [pokemon, setPokemon] = useState(null);
  const [status, setStatus] = useState("idle");
  const [favorites, setFavorites] = useState([]);
  const [favoritesStatus, setFavoritesStatus] = useState("loading");
  const [favoriteActionId, setFavoriteActionId] = useState(null);
  const [favoriteError, setFavoriteError] = useState("");
  const [speechStatus, setSpeechStatus] = useState("idle");
  const [language, setLanguage] = useState("en");
  const [voices, setVoices] = useState([]);
  const [view, setView] = useState("search");

  useEffect(() => {
    loadFavorites();
    const speech = window.speechSynthesis;
    const updateVoices = () => setVoices(speech.getVoices());
    updateVoices();
    speech.addEventListener("voiceschanged", updateVoices);
    return () => { speech.removeEventListener("voiceschanged", updateVoices); speech.cancel(); };
  }, []);
  useEffect(() => {
    if (!pokemon || status !== "success") return undefined;
    const timer = window.setTimeout(() => readDetails(pokemon), 150);
    return () => window.clearTimeout(timer);
  }, [pokemon, status, language, voices.length]);

  async function loadFavorites() {
    setFavoritesStatus("loading"); setFavoriteError("");
    try { const response = await fetch(`${API_URL}/favorites`); if (!response.ok) throw new Error(); setFavorites(await response.json()); setFavoritesStatus("success"); }
    catch { setFavoritesStatus("error"); setFavoriteError("Could not load favorites. Please try again."); }
  }

  async function handleSearch(event) {
    event.preventDefault(); if (!name.trim()) return;
    window.speechSynthesis.cancel(); setSpeechStatus("idle"); setStatus("loading"); setPokemon(null);
    try {
      const response = await fetch(`${API_URL}/pokemon/${encodeURIComponent(name.toLowerCase().trim())}`);
      if (!response.ok) throw new Error(response.status === 404 ? "not-found" : "request-failed");
      setPokemon(await response.json()); setStatus("success"); setView("search");
    } catch (error) { setStatus("error"); setFavoriteError(error.message === "not-found" ? "Pokémon not found. Please check the name and try again." : "Could not connect to the Pokémon service. Please try again."); }
  }

  function readDetails(target = pokemon) {
    if (!target || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const selectedLocale = language === "ta" ? "ta-IN" : "en-US";
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(language === "ta" ? "ta" : "en"));
    const utterance = new SpeechSynthesisUtterance(voiceSummary(target, language));
    utterance.lang = selectedLocale;
    if (matchingVoice) utterance.voice = matchingVoice;
    utterance.rate = language === "ta" ? 0.82 : 0.78; utterance.pitch = 0.7; utterance.volume = 1;
    utterance.onstart = () => setSpeechStatus("speaking"); utterance.onend = () => setSpeechStatus("finished"); utterance.onerror = () => setSpeechStatus("idle");
    window.speechSynthesis.speak(utterance);
  }
  const favoriteIds = useMemo(() => new Set(favorites.map((favorite) => favorite.pokemon_id)), [favorites]);
  const isCurrentFavorite = pokemon && favoriteIds.has(pokemon.id);
  async function toggleFavorite(target) {
    const isFavorite = favoriteIds.has(target.id); setFavoriteActionId(target.id); setFavoriteError("");
    try {
      const response = await fetch(isFavorite ? `${API_URL}/favorites/${target.id}` : `${API_URL}/favorites`, isFavorite ? { method: "DELETE" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pokemon_id: target.id, pokemon_name: target.name, pokemon_image: target.image }) });
      if (!response.ok) throw new Error();
      if (isFavorite) setFavorites((current) => current.filter((favorite) => favorite.pokemon_id !== target.id));
      else { const result = await response.json(); setFavorites((current) => current.some((favorite) => favorite.pokemon_id === target.id) ? current : [result.favorite, ...current]); }
    } catch { setFavoriteError("Could not update favorites. Please try again."); } finally { setFavoriteActionId(null); }
  }

  const typeColor = pokemon ? TYPE_COLORS[pokemon.types[0]] || "#A8A878" : "#9EA791";
  return <div className="stage"><div className={`pokedex ${status === "loading" ? "is-scanning" : ""}`}>
    <div className="top-bar"><div className="lens-housing"><div className="lens"><div className="lens-shine" /></div></div><div className="indicator-lights"><span className="light light-yellow" /><span className="light light-green" /></div><h1 className="brand">Pokédex</h1><button className="language-button" type="button" onClick={() => setLanguage(language === "en" ? "ta" : "en")} aria-label={`Switch to ${language === "en" ? "Tamil" : "English"}`}>{language === "en" ? "தமிழ்" : "EN"}</button></div>
    <div className="screen-bezel"><div className="screen" style={{ "--type-color": typeColor }}><div className="scanlines" />
      {status === "idle" && <div className="screen-msg"><p>NO DATA</p><p className="screen-msg-sub">Enter a name to begin scan</p></div>}
      {status === "loading" && <div className="screen-msg"><p className="blink">SCANNING...</p><p className="screen-msg-sub">searching for {name.toLowerCase()}</p></div>}
      {status === "error" && <div className="screen-msg"><p>NO SIGNAL</p><p className="screen-msg-sub">{favoriteError}</p></div>}
      {status === "success" && pokemon && <div className="entry"><div className="entry-header"><span className="entry-id">ENTRY #{pokemon.id}</span><div className="entry-types">{pokemon.types.map((type) => <span className="entry-type" style={{ background: TYPE_COLORS[type] }} key={type}>{type}</span>)}</div></div><img className="entry-sprite" src={pokemon.image} alt={pokemon.name} /><p className="entry-name">{pokemon.name}</p><div className="entry-stats"><div className="stat"><span className="stat-label">HEIGHT</span><span className="stat-value">{pokemon.height} m</span></div><div className="stat"><span className="stat-label">WEIGHT</span><span className="stat-value">{pokemon.weight} kg</span></div><div className="stat"><span className="stat-label">TOTAL</span><span className="stat-value">{pokemon.total_stats}</span></div></div></div>}
    </div></div>
    <form className="control-panel" onSubmit={handleSearch}><div className="dpad-decor" aria-hidden="true"><span /><span /><span /><span /></div><div className="search-group"><label className="search-label" htmlFor="pokemon-search">Enter Pokémon Name</label><div className="search-row"><input id="pokemon-search" type="text" placeholder="pikachu" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" /><button type="submit" disabled={status === "loading"}>{status === "loading" ? "..." : "Scan"}</button></div></div></form>
    {pokemon && status === "success" && <section className="voice-panel" aria-live="polite"><p>{speechStatus === "speaking" ? "🔊 Reading Pokémon details..." : speechStatus === "finished" ? "✓ Finished reading Pokémon details" : "Voice briefing ready"}</p></section>}
    {pokemon && status === "success" && <section className="extra-details"><p><b>Abilities:</b> {pokemon.abilities.map(titleCase).join(", ")}</p><div className="mini-stats">{Object.entries(STAT_LABELS).map(([key, label]) => <span key={key}>{label} {pokemon.stats[key]}</span>)}</div></section>}
    <section className="favorites-panel" aria-label="My Favorites"><div className="favorites-heading"><h2>My Favorites</h2><button type="button" onClick={() => setView(view === "favorites" ? "search" : "favorites")}>{view === "favorites" ? "Back to Search" : `View (${favorites.length})`}</button></div>{view === "favorites" && <div className="favorites-content">{favoritesStatus === "loading" && <p>Loading favorites...</p>}{favoritesStatus === "error" && <div><p>{favoriteError}</p><button type="button" onClick={loadFavorites}>Try again</button></div>}{favoritesStatus === "success" && favorites.length === 0 && <p>No Pokémon added to favorites yet.</p>}{favoritesStatus === "success" && favorites.map((favorite) => <article className="favorite-card" key={favorite.id ?? favorite.pokemon_id}><img src={favorite.pokemon_image} alt={favorite.pokemon_name} /><div><strong>{favorite.pokemon_name}</strong><span>#{favorite.pokemon_id}</span></div><button type="button" onClick={() => toggleFavorite({ id: favorite.pokemon_id })}>{favoriteActionId === favorite.pokemon_id ? "Removing..." : "Remove"}</button></article>)}</div>}{pokemon && status === "success" && <button className={`favorite-button ${isCurrentFavorite ? "is-favorite" : ""}`} type="button" onClick={() => toggleFavorite(pokemon)} disabled={favoriteActionId === pokemon.id || favoritesStatus === "loading"}>{isCurrentFavorite ? "♡ Remove from Favorites" : "♥ Add to Favorites"}</button>}{favoriteError && status !== "error" && <p className="favorite-error">{favoriteError}</p>}</section>
    <div className="grill" aria-hidden="true"><span /><span /><span /><span /><span /></div>
  </div></div>;
}
export default App;
