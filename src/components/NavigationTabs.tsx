import React from 'react';

interface Tab {
  id: string;
  label: string;
}

interface NavigationTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const NavigationTabs: React.FC<NavigationTabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="tabs" role="tablist" aria-label="Budget level navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          disabled={tab.id !== 'city'} // Only city is implemented for now
          title={tab.id !== 'city' ? 'Coming soon' : ''}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default NavigationTabs;
