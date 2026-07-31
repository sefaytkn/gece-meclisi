import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { UpdateNotice } from "./components/UpdateNotice";
import { unlockGameAudio } from "./services/gameAudio";

const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const GamesPage = lazy(() => import("./pages/GamesPage").then((module) => ({ default: module.GamesPage })));
const VampireInfoPage = lazy(() =>
  import("./games/vampire-village/pages/VampireInfoPage").then((module) => ({ default: module.VampireInfoPage }))
);
const CreateRoomPage = lazy(() =>
  import("./pages/CreateRoomPage").then((module) => ({ default: module.CreateRoomPage }))
);
const JoinRoomPage = lazy(() => import("./pages/JoinRoomPage").then((module) => ({ default: module.JoinRoomPage })));
const LobbyPage = lazy(() =>
  import("./games/vampire-village/pages/LobbyPage").then((module) => ({ default: module.LobbyPage }))
);
const GamePage = lazy(() =>
  import("./games/vampire-village/pages/GamePage").then((module) => ({ default: module.GamePage }))
);
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink text-white">
      <div className="text-center">
        <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-rose-400" />
        <p className="mt-4 text-sm text-mist">Gece hazırlanıyor...</p>
      </div>
    </div>
  );
}

export function App() {
  useEffect(() => {
    const unlock = () => unlockGameAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <>
      <UpdateNotice />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/vampire-village" element={<VampireInfoPage />} />
          <Route path="/rooms/create" element={<CreateRoomPage />} />
          <Route path="/rooms/join" element={<JoinRoomPage />} />
          <Route path="/rooms/:code/lobby" element={<LobbyPage />} />
          <Route path="/rooms/:code/game" element={<GamePage />} />
          <Route path="/profile" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
