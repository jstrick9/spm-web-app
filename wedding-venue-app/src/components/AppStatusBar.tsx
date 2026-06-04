import React from 'react';

export interface StatusBarItem {
  id: string;
  kind: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

interface AppStatusBarProps {
  items: StatusBarItem[];
}

function getKindClasses(kind: StatusBarItem['kind']): string {
  switch (kind) {
    case 'success':
      return 'border-green-200 bg-green-50';
    case 'warning':
      return 'border-amber-200 bg-amber-50';
    case 'error':
      return 'border-red-200 bg-red-50';
    case 'info':
    default:
      return 'border-blue-200 bg-blue-50';
  }
}

function getTitleClasses(kind: StatusBarItem['kind']): string {
  switch (kind) {
    case 'success':
      return 'text-green-800';
    case 'warning':
      return 'text-amber-900';
    case 'error':
      return 'text-red-800';
    case 'info':
    default:
      return 'text-blue-800';
  }
}

export const AppStatusBar: React.FC<AppStatusBarProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <div className="border-b bg-white px-4 py-3 space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg border px-4 py-3 ${getKindClasses(item.kind)}`}
          data-kind={item.kind}
        >
          <div className={`font-medium text-sm ${getTitleClasses(item.kind)}`}>
            {item.title}
          </div>

          {item.description && (
            <div className="mt-1 text-sm text-gray-600">{item.description}</div>
          )}

          {item.actions && item.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.actions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={action.onClick}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AppStatusBar;