import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { DeviceList } from './DeviceList.js';
import { Header } from './Header.js';
import { store } from './store.js';
import './styles.css';

const root = document.getElementById('root');
if (root === null) throw new Error('#root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <Header />
      <main className="page">
        <div className="page-heading">
          <h1>Devices</h1>
          <p className="muted">Latest reading per device.</p>
        </div>
        <DeviceList />
      </main>
    </Provider>
  </StrictMode>,
);
