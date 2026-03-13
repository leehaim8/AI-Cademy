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
import CoursesPage from "./pages/CoursesPage";
import CourseSettingsPage from "./pages/CourseSettingsPage";
import CourseAgentPage from "./pages/CourseAgentPage";
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
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/courses" replace />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/home" element={<Navigate to="/courses" replace />} />
        <Route
          path="/courses"
          element={
            <RequireAuth>
              <CoursesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/courses/:courseId/agents"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/courses/:courseId/settings"
          element={
            <RequireAuth>
              <CourseSettingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/courses/:courseId/agents/:agentKey"
          element={
            <RequireAuth>
              <CourseAgentPage />
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
        <Route path="*" element={<Navigate to="/courses" replace />} />
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
