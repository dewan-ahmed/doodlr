import { useState } from "react";
import Home from "./pages/Home.jsx";
import Game from "./pages/Game.jsx";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null); // { room, player }

  if (!session) {
    return <Home onJoined={setSession} />;
  }

  return <Game room={session.room} player={session.player} />;
}
