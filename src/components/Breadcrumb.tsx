import React from 'react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb navigation">
      <ol className="breadcrumb-content">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <li className="breadcrumb-separator" aria-hidden="true">
                ›
              </li>
            )}
            <li>
              {item.onClick ? (
                <button
                  className="breadcrumb-item breadcrumb-button"
                  onClick={item.onClick}
                  aria-current={index === items.length - 1 ? 'page' : undefined}
                >
                  {item.label}
                </button>
              ) : (
                <span
                  className={`breadcrumb-item ${index === items.length - 1 ? 'active selected-breadcrumb' : ''}`}
                  aria-current={index === items.length - 1 ? 'page' : undefined}
                >
                  {item.label}
                  {index === items.length - 1 && (
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 16 16" 
                      fill="none"
                      style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}
                      aria-hidden="true"
                    >
                      <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
