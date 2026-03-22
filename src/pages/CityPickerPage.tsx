import { Link } from 'react-router';
import { CITY_REGISTRY } from '../config/cityRegistry';
import './CityPickerPage.css';

export default function CityPickerPage() {
  return (
    <div className="city-picker-page">
      <div className="city-picker-container">
        <h1 className="city-picker-heading">Choose a City</h1>
        <div className="city-picker-grid">
          {CITY_REGISTRY.map(city =>
            city.isComingSoon ? (
              <div key={city.slug} className="city-card city-card--disabled" aria-disabled="true">
                <span className="city-card-name">{city.displayName}</span>
                <span className="city-card-badge">Coming Soon</span>
              </div>
            ) : (
              <Link key={city.slug} to={`/${city.slug}`} className="city-card city-card--active">
                <span className="city-card-name">{city.displayName}</span>
                <span className="city-card-action">View budget -&gt;</span>
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}
