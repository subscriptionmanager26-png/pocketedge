import React, { useState } from 'react';
import { LayoutGrid, FileText } from 'lucide-react';
import SearchBasketCard from './SearchBasketCard';
import BasketDetailView from './BasketDetailView';
import { enrichBasket } from '../basketCatalog';

const VIEWS = [
  { id: 'card', label: 'Search card', icon: LayoutGrid },
  { id: 'detail', label: 'Detail page', icon: FileText },
];

export default function BasketPreviewPanel({ basket }) {
  const [view, setView] = useState('card');
  const enriched = enrichBasket(basket);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-neutral-100 border border-neutral-200/80 rounded-xl">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              view === id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {view === 'card' ? (
        <div className="max-w-md mx-auto pointer-events-none">
          <SearchBasketCard basket={enriched} preview />
        </div>
      ) : (
        <div className="border border-neutral-200/80 rounded-2xl overflow-hidden bg-neutral-50">
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
            <BasketDetailView basket={enriched} isOwn preview />
          </div>
        </div>
      )}
    </div>
  );
}
