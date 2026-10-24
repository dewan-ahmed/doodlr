// Small localStorage-backed helpers for reconnect support:
// - a stable per-browser clientId so the server can restore your score
//   after a refresh (see server/src/rooms.js addPlayer)
// - the last room/name you joined, so we can silently rejoin on page load

const CLIENT_ID_KEY = "doodlr:clientId";
const SESSION_KEY = "doodlr:session";

export function getClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function saveSession(room, name) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ room, name }));
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  return room ? room.toUpperCase() : "";
}
