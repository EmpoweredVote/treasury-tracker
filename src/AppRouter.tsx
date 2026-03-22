import { Routes, Route, Navigate } from 'react-router';
import CityPickerPage from './pages/CityPickerPage';
import CityPage from './pages/CityPage';
import { CITY_REGISTRY } from './config/cityRegistry';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<CityPickerPage />} />
      {CITY_REGISTRY
        .filter(city => !city.isComingSoon)
        .map(city => (
          <Route
            key={city.slug}
            path={`/${city.slug}`}
            element={<CityPage slug={city.slug} />}
          />
        ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
