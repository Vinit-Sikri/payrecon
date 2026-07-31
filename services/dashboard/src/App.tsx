import { NavLink, Route, Routes } from "react-router-dom";
import { Overview } from "./pages/Overview";
import { Orders } from "./pages/Orders";
import { Mismatches } from "./pages/Mismatches";
import { Ledger } from "./pages/Ledger";
import { Settlements } from "./pages/Settlements";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/orders", label: "Orders" },
  { to: "/mismatches", label: "Mismatches" },
  { to: "/ledger", label: "Ledger" },
  { to: "/settlements", label: "Settlements" },
];

export default function App() {
  return (
    <>
      <nav className="app-nav">
        <h1>PayRecon</h1>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/mismatches" element={<Mismatches />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/settlements" element={<Settlements />} />
        </Routes>
      </main>
    </>
  );
}
