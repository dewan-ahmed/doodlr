import { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import Lobby from "./pages/Lobby.jsx";
import Choosing from "./pages/Choosing.jsx";
import Game from "./pages/Game.jsx";
import { socket } from "./socket.js";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null); // { room, player }
  const [players, setPlayers] = useState([]);
  const [screen, setScreen] = useState("home"); // home | lobby | game
  const [round, setRound] = useState(null); // { round, drawerId, wordLength }
  const [myWord, setMyWord] = useState(null); // only set when I'm the drawer
  const [wordChoices, setWordChoices] = useState(null); // only set when I'm the drawer
  const [roundEnd, setRoundEnd] = useState(null); // { reason, word, players }

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

    socket.on("room:players", handlePlayers);
    socket.on("round:choosing", handleRoundChoosing);
    socket.on("word:choices", handleWordChoices);
    socket.on("round:start", handleRoundStart);
    socket.on("round:end", handleRoundEnd);

    return () => {
      socket.off("room:players", handlePlayers);
      socket.off("round:choosing", handleRoundChoosing);
      socket.off("word:choices", handleWordChoices);
      socket.off("round:start", handleRoundStart);
      socket.off("round:end", handleRoundEnd);
    };
  }, []);

  function handleJoined({ room, player, players: initialPlayers }) {
    setSession({ room, player });
    setPlayers(initialPlayers || []);
    setScreen("lobby");
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
