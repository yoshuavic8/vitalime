import { useEffect } from "react";
import { HashRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Activity, Dumbbell, House, TrendingUp, Utensils, WifiOff } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { ToastProvider, cx } from "./components/ui";
import { useOnline } from "./hooks";
import { ensureExerciseSeed } from "./db/repo/training";
import { requestPersistentStorage } from "./lib/storage";
import { setSetting, SETTING_KEYS } from "./db/repo/settings";
import HomePage from "./pages/HomePage";
import FoodPage from "./pages/FoodPage";
import FoodEditorPage from "./pages/FoodEditorPage";
import ActivityPage from "./pages/ActivityPage";
import HealthImportPage from "./pages/HealthImportPage";
import TrainingPage from "./pages/TrainingPage";
import ProgramEditorPage from "./pages/ProgramEditorPage";
import SessionPage from "./pages/SessionPage";
import ExerciseDetailPage from "./pages/ExerciseDetailPage";
import ProgressPage from "./pages/ProgressPage";
import ReportPage from "./pages/ReportPage";
import SettingsPage from "./pages/SettingsPage";

const TABS = [
  { to: "/", label: "Home", icon: House },
  { to: "/food", label: "Food", icon: Utensils },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/training", label: "Training", icon: Dumbbell },
  { to: "/progress", label: "Progress", icon: TrendingUp },
];

function TabBar() {
  const { pathname } = useLocation();
  const hidden = pathname.startsWith("/food/") || pathname.startsWith("/training/session");
  if (hidden) return null;
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 px-3">
      <div className="mx-auto flex max-w-xl items-center justify-between rounded-[26px] border border-white/[0.08] bg-ink-900/85 px-2 py-1.5 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cx(
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-semibold transition",
                isActive ? "text-lime-400" : "text-ink-400 active:text-ink-100",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cx("grid h-8 w-12 place-items-center rounded-full transition", isActive && "bg-lime-400/12")}>
                  <Icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 1.9} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // iOS keeps standalone PWAs alive for long periods; poll for new versions hourly.
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="pt-safe fixed inset-x-0 top-0 z-40 px-3">
      <div className="animate-fade-in mx-auto mt-2 flex max-w-xl items-center gap-3 rounded-2xl border border-lime-400/30 bg-ink-850/95 p-3 backdrop-blur-xl">
        <div className="flex-1 text-sm">
          <div className="font-semibold">Versi baru tersedia</div>
          <div className="text-ink-400">Data kamu tetap aman di perangkat.</div>
        </div>
        <button className="px-2 text-sm text-ink-400" onClick={() => setNeedRefresh(false)}>
          Nanti
        </button>
        <button className="rounded-xl bg-lime-400 px-3 py-2 text-sm font-bold text-ink-950" onClick={() => updateServiceWorker(true)}>
          Perbarui
        </button>
      </div>
    </div>
  );
}

function OfflinePill() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 flex justify-center">
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-800/90 px-3 py-1 text-xs text-ink-300 backdrop-blur">
        <WifiOff className="size-3.5" /> Offline — data tetap tersimpan lokal
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  useEffect(() => {
    ensureExerciseSeed();
    requestPersistentStorage().then((granted) => {
      if (granted != null) setSetting(SETTING_KEYS.persistGranted, granted);
    });
  }, []);

  return (
    <ToastProvider>
      <HashRouter>
        <ScrollToTop />
        <UpdateBanner />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/food/new" element={<FoodEditorPage />} />
          <Route path="/food/:id" element={<FoodEditorPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/activity/import" element={<HealthImportPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/training/program/:id" element={<ProgramEditorPage />} />
          <Route path="/training/session/:id" element={<SessionPage />} />
          <Route path="/training/exercise/:id" element={<ExerciseDetailPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
        <OfflinePill />
        <TabBar />
      </HashRouter>
    </ToastProvider>
  );
}
