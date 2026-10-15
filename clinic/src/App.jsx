import { Navigate, Route, Routes } from 'react-router-dom';
import StaffLayout from './components/StaffLayout';
import Appointments from './pages/Appointments';
import Book from './pages/Book';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Patients from './pages/Patients';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Book />} />
      <Route path="/staff/login" element={<Login />} />
      <Route path="/staff" element={<StaffLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="patients" element={<Patients />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
