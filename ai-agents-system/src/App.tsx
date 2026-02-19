import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import type { ReactElement } from "react";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import AgentPage from "./pages/AgentPage";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import { getCurrentUser } from "./lib/authStorage";

function RequireAuth({ children }: { children: ReactElement }) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  return children;
}

function AppRoutes() {
  const location = useLocation();
  const hideNavbar =
    location.pathname === "/signin" || location.pathname === "/signup";

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/agent/:id"
          element={
            <RequireAuth>
              <AgentPage />
            </RequireAuth>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAuth>
              <UsersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
