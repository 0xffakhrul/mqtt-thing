import { DeviceList } from './DeviceList.js';

export const DevicesPage = () => (
  <>
    <div className="page-heading">
      <h1>Devices</h1>
      <p className="muted">Latest reading per device.</p>
    </div>
    <DeviceList />
  </>
);
