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
    <nav className="px-6 py-3 max-w-[1400px] mx-auto" aria-label="Breadcrumb navigation">
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <li className="text-[#6B7280]" aria-hidden="true">
                /
              </li>
            )}
            <li>
              {item.onClick ? (
                <button
                  className="text-ev-muted-blue hover:underline cursor-pointer font-medium bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2 rounded"
                  onClick={item.onClick}
                  aria-current={index === items.length - 1 ? 'page' : undefined}
                >
                  {item.label}
                </button>
              ) : (
                <span
                  className="text-[#1C1C1C] font-medium"
                  aria-current={index === items.length - 1 ? 'page' : undefined}
                >
                  {item.label}
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
