import { Route, Routes } from 'react-router-dom';
import { Layout, RequireRole } from './components/ui';
import Home from './pages/Home';
import Departures from './pages/Departures';
import DepartureDetail from './pages/DepartureDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import MyTrips from './pages/MyTrips';
import TripDetail from './pages/TripDetail';
import Staff from './pages/Staff';
import StaffDeparture from './pages/StaffDeparture';
import Admin from './pages/Admin';
import Legal from './pages/Legal';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="departures" element={<Departures />} />
        <Route path="departures/:id" element={<DepartureDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="trips" element={<RequireRole><MyTrips /></RequireRole>} />
        <Route path="trips/:ref" element={<RequireRole><TripDetail /></RequireRole>} />
        <Route path="staff" element={<RequireRole roles={['staff', 'admin']}><Staff /></RequireRole>} />
        <Route path="staff/departures/:id" element={<RequireRole roles={['staff', 'admin']}><StaffDeparture /></RequireRole>} />
        <Route path="admin" element={<RequireRole roles={['admin']}><Admin /></RequireRole>} />
        <Route path="terms" element={<Legal kind="terms" />} />
        <Route path="privacy" element={<Legal kind="privacy" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
