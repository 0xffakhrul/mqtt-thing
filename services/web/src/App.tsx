import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Header } from './components/Header.js';
import { DevicesPage } from './features/devices/DevicesPage.js';

const DevicePage = lazy(() =>
  import('./features/devices/DevicePage.js').then((module) => ({
    default: module.DevicePage,
  })),
);

export const App = () => (
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
