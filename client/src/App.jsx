import { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import Lobby from "./pages/Lobby.jsx";
import Choosing from "./pages/Choosing.jsx";
import Game from "./pages/Game.jsx";
import GameOver from "./pages/GameOver.jsx";
import { socket } from "./socket.js";
import { clearSession, getClientId, getRoomCodeFromUrl, loadSession, saveSession } from "./session.js";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null); // { room, player }
  const [players, setPlayers] = useState([]);
  const [screen, setScreen] = useState("home"); // home | lobby | choosing | game | game-over
  const [round, setRound] = useState(null); // { round, drawerId, wordLength }
  const [myWord, setMyWord] = useState(null); // only set when I'm the drawer
  const [wordChoices, setWordChoices] = useState(null); // only set when I'm the drawer
  const [roundEnd, setRoundEnd] = useState(null); // { reason, word, players }
  // True while we're silently attempting to rejoin a previously-saved room
  // (e.g. the page was just refreshed) — avoids flashing the join form.
  const [reconnecting, setReconnecting] = useState(() => !!loadSession());

  useEffect(() => {
    function handlePlayers(list) {
      setPlayers(list);
    }

    function handleRoundChoosing(payload) {
      setMyWord(null);
      setWordChoices(null);
      setRound(payload);
      setScreen("choosing");
    }

    function handleWordChoices({ choices }) {
      setWordChoices(choices);
    }

    function handleRoundStart(payload) {
      setRound(payload);
      setRoundEnd(null);
      setScreen("game");
    }

    function handleRoundEnd(payload) {
      setRoundEnd(payload);
      setPlayers(payload.players);
    }

    function handleGameOver(payload) {
      setPlayers(payload.players);
      setScreen("game-over");
      clearSession(); // the game's over — don't auto-rejoin this room next load
    }

    socket.on("room:players", handlePlayers);
    socket.on("round:choosing", handleRoundChoosing);
    socket.on("word:choices", handleWordChoices);
    socket.on("round:start", handleRoundStart);
    socket.on("round:end", handleRoundEnd);
    socket.on("game:over", handleGameOver);

    return () => {
      socket.off("room:players", handlePlayers);
      socket.off("round:choosing", handleRoundChoosing);
      socket.off("word:choices", handleWordChoices);
      socket.off("round:start", handleRoundStart);
      socket.off("round:end", handleRoundEnd);
      socket.off("game:over", handleGameOver);
    };
  }, []);

  function handleJoined({ room, player, players: initialPlayers, gameState }) {
    setSession({ room, player });
    setPlayers(initialPlayers || []);
    saveSession(room, player.name);

    // Reflect the room in the URL so the address bar itself is a shareable
    // invite link (and refreshing while in the lobby keeps ?room= around).
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    window.history.replaceState({}, "", url);

    // If a game is already in progress (e.g. this is a reconnect mid-game),
    // jump straight to the right screen instead of always showing the lobby.
    if (gameState && gameState.status !== "lobby") {
      setRound({
        round: gameState.round,
        drawerId: gameState.drawerId,
        wordLength: gameState.wordLength,
        roundEndsAt: gameState.roundEndsAt,
      });
      setRoundEnd(null);
      setScreen(gameState.status === "choosing" ? "choosing" : "game");
    } else {
      setScreen("lobby");
    }
  }

  // On first load, silently try to rejoin whatever room/name we last used
  // (persisted in localStorage) — this is what makes a page refresh resume
  // your session instead of dumping you back on the join form.
  useEffect(() => {
    const stored = loadSession();
    if (!stored) {
      setReconnecting(false);
      return;
    }

    // If the URL points at a *different* room (e.g. someone clicked a fresh
    // invite link), prefer that explicit intent over the stale session.
    const urlRoom = getRoomCodeFromUrl();
    if (urlRoom && urlRoom !== stored.room) {
      clearSession();
      setReconnecting(false);
      return;
    }

    if (!socket.connected) socket.connect();
    socket.emit("room:join", { code: stored.room, name: stored.name, clientId: getClientId() }, (res) => {
      setReconnecting(false);
      if (res?.error) {
        clearSession();
        return;
      }
      handleJoined(res);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reconnecting) {
    return (
      <div className="home">
        <h1>Doodlr</h1>
        <p>Reconnecting…</p>
      </div>
    );
  }

  if (screen === "home" || !session) {
    return <Home onJoined={handleJoined} />;
  }

  if (screen === "lobby") {
    return <Lobby room={session.room} player={session.player} players={players} />;
  }

  if (screen === "choosing") {
    const isDrawer = round?.drawerId === session.player.id;
    const drawerName = players.find((p) => p.id === round?.drawerId)?.name;
    return (
      <Choosing
        isDrawer={isDrawer}
        drawerName={drawerName}
        choices={wordChoices}
        onChoose={setMyWord}
      />
    );
  }

  if (screen === "game-over") {
    return <GameOver players={players} />;
  }

  return (
    <Game
      room={session.room}
      player={session.player}
      players={players}
      round={round}
      myWord={myWord}
      roundEnd={roundEnd}
    />
  );
}
