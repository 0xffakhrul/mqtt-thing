import { DeviceList } from './DeviceList.js';
import { RecentReadings } from './RecentReadings.js';

export const DevicesPage = () => (
  <>
    <div className="page-heading">
      <h1>Devices</h1>
      <p className="muted">Latest reading per device. Values update live over the stream.</p>
    </div>
    <DeviceList />
    <RecentReadings limit={8} />
  </>
);
