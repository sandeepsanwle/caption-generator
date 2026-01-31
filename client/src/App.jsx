import { useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import MergePage from "./pages/MergePage.jsx";

export default function App() {
  const [tab, setTab] = useState("caption");

  return (
    <>
      <nav className="tabs">
        <button
          type="button"
          className={`tabs__btn ${tab === "caption" ? "tabs__btn--active" : ""}`}
          onClick={() => setTab("caption")}
        >
          Captions
        </button>
        <button
          type="button"
          className={`tabs__btn ${tab === "merge" ? "tabs__btn--active" : ""}`}
          onClick={() => setTab("merge")}
        >
          Merge videos
        </button>
      </nav>
      {tab === "caption" ? <HomePage /> : <MergePage />}
    </>
  );
}

