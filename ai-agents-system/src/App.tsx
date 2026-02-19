import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import AgentPage from "./pages/AgentPage";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agent/:id" element={<AgentPage />} />
      </Routes>
    </BrowserRouter>
  );
}
