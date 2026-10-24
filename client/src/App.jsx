import { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import Lobby from "./pages/Lobby.jsx";
import Game from "./pages/Game.jsx";
import { socket } from "./socket.js";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null); // { room, player }
  const [players, setPlayers] = useState([]);
  const [screen, setScreen] = useState("home"); // home | lobby | game
  const [round, setRound] = useState(null); // { round, drawerId, wordLength }
  const [myWord, setMyWord] = useState(null); // only set when I'm the drawer

  useEffect(() => {
    function handlePlayers(list) {
      setPlayers(list);
    }

    function handleRoundStart(payload) {
      setRound(payload);
      setScreen("game");
    }

    function handleWordAssigned({ word }) {
      setMyWord(word);
    }

    socket.on("room:players", handlePlayers);
    socket.on("round:start", handleRoundStart);
    socket.on("word:assigned", handleWordAssigned);

    return () => {
      socket.off("room:players", handlePlayers);
      socket.off("round:start", handleRoundStart);
      socket.off("word:assigned", handleWordAssigned);
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

  return (
    <Game
      room={session.room}
      player={session.player}
      players={players}
      round={round}
      myWord={myWord}
    />
  );
}
