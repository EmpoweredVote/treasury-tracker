import { Routes, Route, Navigate } from 'react-router';
import CityPickerPage from './pages/CityPickerPage';
import CityPage from './pages/CityPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<CityPickerPage />} />
      <Route path="/bloomington" element={<CityPage slug="bloomington" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
