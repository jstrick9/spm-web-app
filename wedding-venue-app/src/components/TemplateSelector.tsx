import { useState } from 'react';
import { LayoutTemplate, LayoutCategoryInfo } from '../types';
import { getVenues } from '../hooks/useLayoutState';
import ModalDialog from './ModalDialog';

export interface TemplateSelectorProps {
  templates: LayoutTemplate[];
  layoutCategories: LayoutCategoryInfo[];
  onSelect: (template: LayoutTemplate) => void;
  onClose: () => void;
}

export function TemplateSelector({
  templates,
  layoutCategories,
  onSelect,
  onClose,
}: TemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | string>('all');
  const venues = getVenues();

  const filteredTemplates =
    selectedCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === selectedCategory);

  const getVenueName = (venueId: string) => {
    return venues.find((v) => v.id === venueId)?.name || 'Unknown Venue';
  };

  return (
    <ModalDialog
      title="Layout Templates"
      description="Choose a template to get started"
      onClose={onClose}
      className="max-w-5xl"
    >
      <div className="space-y-6">
        <div
          role="tablist"
          aria-label="Template categories"
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              selectedCategory === 'all'
                ? 'bg-[#4A1942] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Templates
          </button>

          {layoutCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-[#4A1942] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
            No templates available for this category.
          </div>
        ) : (
          <div
            role="list"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {filteredTemplates.map((template) => {
              const category = layoutCategories.find((c) => c.id === template.category);

              return (
                <button
                  key={template.id}
                  type="button"
                  role="listitem"
                  onClick={() => onSelect(template)}
                  className="text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-[#4A1942]/40 transition"
                  aria-label={`Use template ${template.name} for ${getVenueName(
                    template.venueId,
                  )}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-2xl">{category?.icon || '📋'}</div>
                    <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                      {category?.name || template.category}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {template.name}
                  </h3>

                  {template.description && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                      {template.description}
                    </p>
                  )}

                  <div className="mt-4 text-sm text-gray-500 space-y-1">
                    <div>{getVenueName(template.venueId)}</div>
                    <div>{template.tables.length} tables</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}