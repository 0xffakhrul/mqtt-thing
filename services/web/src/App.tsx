import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { useAppSelector } from './app/hooks.js';
import { Header } from './components/Header.js';
import { selectSession } from './features/auth/authSlice.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { DevicesPage } from './features/devices/DevicesPage.js';

const DevicePage = lazy(() =>
  import('./features/devices/DevicePage.js').then((module) => ({
    default: module.DevicePage,
  })),
);

export const App = () => {
  const session = useAppSelector(selectSession);

  if (session === null) return <LoginPage />;

  return (
    <>
      <Header />
      <main className="page">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Routes>
            <Route path="/" element={<DevicesPage />} />
            <Route path="/devices/:deviceId" element={<DevicePage />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
};
