import { Link } from 'react-router';
import './CityPickerPage.css';

export default function CityPickerPage() {
  return (
    <div className="city-picker-page">
      <div className="city-picker-container">
        <h1 className="city-picker-heading">Choose a City</h1>
        <div className="city-picker-grid">
          <Link to="/bloomington" className="city-card city-card--active">
            <span className="city-card-name">Bloomington, IN</span>
            <span className="city-card-action">View budget -&gt;</span>
          </Link>
          <div className="city-card city-card--disabled" aria-disabled="true">
            <span className="city-card-name">Los Angeles, CA</span>
            <span className="city-card-badge">Coming Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
