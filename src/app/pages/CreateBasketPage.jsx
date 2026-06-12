import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  ImagePlus,
  Layers,
  Plus,
  Trash2,
  FileText,
} from 'lucide-react';
import {
  buildCustomStock,
  IBKR_SYMBOL_NOTE,
  isValidStockSymbol,
  normalizeStockSymbol,
  stockUniverse,
} from '../basketCatalog';
import { REBALANCE_FREQUENCIES } from '../rebalanceOptions';
import { canCreateBasket, createBasketId, MAX_USER_BASKETS, saveUserBasket } from '../basketStore';
import { navigateApp } from '../appRoute';
import PageHeader from '../../components/PageHeader';
import BasketPreviewPanel from '../components/BasketPreviewPanel';
import AppPageLayout from '../components/AppPageLayout';

const GRADIENTS = [
  'from-emerald-600 to-cyan-500',
  'from-violet-600 to-fuchsia-500',
  'from-amber-600 to-orange-500',
  'from-blue-600 to-indigo-500',
];

const STEPS = [
  { id: 'basics', label: 'Basics', icon: FileText },
  { id: 'cover', label: 'Cover', icon: ImagePlus },
  { id: 'stocks', label: 'Stocks', icon: Layers },
  { id: 'preview', label: 'Preview', icon: Eye },
];

function applyEqualWeights(list) {
  const w = list.length ? Math.floor((100 / list.length) * 10) / 10 : 0;
  return list.map((c, i) => ({
    ...c,
    weight: i === list.length - 1 ? +(100 - w * (list.length - 1)).toFixed(1) : w,
  }));
}

function CreateBasketsHub({ userBaskets }) {
  const canCreate = canCreateBasket(userBaskets);

  return (
    <AppPageLayout center className="pb-4 max-w-2xl">
      <PageHeader
        title="Create"
        align="center"
        className="!mb-0"
        description={
          canCreate
            ? `${userBaskets.length} of ${MAX_USER_BASKETS} baskets · publish ideas and compete on the leaderboard`
            : `All ${MAX_USER_BASKETS} basket slots used — edit an existing basket to improve your rank`
        }
      />

      {canCreate && userBaskets.length > 0 && (
        <button
          type="button"
          onClick={() => navigateApp({ tab: 'create', createNew: true })}
          className="w-full pe-btn-primary py-3.5 text-base justify-center gap-2"
        >
          <Plus className="w-5 h-5" aria-hidden />
          Create new basket
        </button>
      )}

      {userBaskets.length > 0 ? (
        <section className="space-y-2">
          <h2 className="pe-section-title text-base px-0.5">Your baskets</h2>
          <ul className="space-y-2">
            {userBaskets.map((basket) => (
              <li key={basket.id}>
                <div className="pe-card p-4 flex items-center gap-3 sm:gap-4">
                  <div
                    className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${
                      basket.imageGradient || 'from-emerald-600 to-cyan-500'
                    } flex items-center justify-center overflow-hidden`}
                  >
                    {basket.imageUrl ? (
                      <img src={basket.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-white/90">{basket.name.charAt(0)}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <p className="pe-card-title truncate">{basket.name}</p>
                    <p className="pe-body-s mt-0.5">
                      {basket.constituents?.length ?? 0} stocks ·{' '}
                      {basket.weightingType === 'equal' ? 'Equal' : 'Custom'} weight
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => navigateApp({ tab: 'basket', basketId: basket.id })}
                      className="px-3 py-2 rounded-lg border border-pe-border/80 text-xs font-semibold text-neutral-700 hover:text-neutral-900 hover:border-neutral-300 transition-colors"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateApp({ tab: 'create', editBasketId: basket.id })}
                      className="px-3 py-2 rounded-lg bg-neutral-900 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="pe-card border-dashed p-8 text-center">
          <Layers className="w-8 h-8 text-neutral-400 mx-auto mb-3" aria-hidden />
          <p className="text-base font-medium text-neutral-900">No baskets yet</p>
          <p className="text-sm text-neutral-500 mt-1 mb-5">
            Build your first basket and enter The Global Portfolio League.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={() => navigateApp({ tab: 'create', createNew: true })}
              className="pe-btn-primary px-6 py-3 text-sm"
            >
              Create your first basket
            </button>
          )}
        </div>
      )}
    </AppPageLayout>
  );
}

export default function CreateBasketPage({
  editBasketId = null,
  creatingNew = false,
  editBasket = null,
  onCreated,
  userProfile,
  displayName = 'You',
  userBaskets = [],
}) {
  const isEditing = Boolean(editBasketId);
  const inWizard = isEditing || creatingNew;

  if (!inWizard) {
    return <CreateBasketsHub userBaskets={userBaskets} />;
  }

  const atBasketLimit = !isEditing && !canCreateBasket(userBaskets);
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState(editBasket?.name ?? '');
  const [shortDescription, setShortDescription] = useState(editBasket?.shortDescription ?? '');
  const [description, setDescription] = useState(editBasket?.description ?? '');
  const [imageUrl, setImageUrl] = useState(editBasket?.imageUrl ?? '');
  const [imageGradient, setImageGradient] = useState(
    editBasket?.imageGradient ?? GRADIENTS[0]
  );
  const [weightingType, setWeightingType] = useState(editBasket?.weightingType ?? 'equal');
  const [rebalanceFrequency, setRebalanceFrequency] = useState(
    editBasket?.rebalanceFrequency ?? 'quarterly'
  );
  const [constituents, setConstituents] = useState(
    editBasket?.constituents?.length
      ? editBasket.constituents.map((c) => ({ ...c }))
      : [
          { symbol: 'AAPL', name: 'Apple', weight: 50, segment: 'Largecap' },
          { symbol: 'MSFT', name: 'Microsoft', weight: 50, segment: 'Largecap' },
        ]
  );
  const [stockQuery, setStockQuery] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const step = STEPS[stepIndex];
  const weightTotal = useMemo(
    () => constituents.reduce((s, c) => s + (Number(c.weight) || 0), 0),
    [constituents]
  );

  const filteredStocks = useMemo(() => {
    const q = stockQuery.trim().toLowerCase();
    const selected = new Set(constituents.map((c) => c.symbol));
    return stockUniverse.filter(
      (s) =>
        !selected.has(s.symbol) &&
        (s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    );
  }, [stockQuery, constituents]);

  const normalizedStockQuery = useMemo(() => normalizeStockSymbol(stockQuery), [stockQuery]);

  const exactUniverseMatch = useMemo(
    () => stockUniverse.find((s) => s.symbol === normalizedStockQuery),
    [normalizedStockQuery]
  );

  const canAddCustomSymbol = useMemo(() => {
    if (!stockQuery.trim() || !isValidStockSymbol(stockQuery)) return false;
    if (constituents.some((c) => c.symbol === normalizedStockQuery)) return false;
    if (exactUniverseMatch) return false;
    return true;
  }, [stockQuery, normalizedStockQuery, constituents, exactUniverseMatch]);

  const showStockSuggestions =
    stockQuery.trim().length > 0 && (filteredStocks.length > 0 || canAddCustomSymbol);

  const draftBasket = useMemo(
    () => ({
      id: 'preview',
      name: name.trim() || 'Untitled basket',
      shortDescription:
        shortDescription.trim() ||
        description.trim().slice(0, 120) ||
        'Your one-line summary appears here.',
      description: description.trim(),
      imageUrl,
      imageGradient,
      type: 'Custom',
      tags: ['Custom'],
      weightingType,
      rebalanceFrequency,
      constituents:
        weightingType === 'equal' ? applyEqualWeights(constituents) : constituents,
      stats: {
        minInvestAmount: 5000,
        volatility: 'Medium Volatility',
        constituents: constituents.length,
        returnLabel: 'Since launch',
        cagr: 0,
      },
      creatorName: displayName,
      creator: {
        name: displayName,
        bio: userProfile?.bio || 'Independent basket creator on PocketEdge.',
        avatarUrl: userProfile?.avatarUrl || '',
        links: userProfile?.links || [],
        followers: 0,
      },
      isOwn: true,
      followers: 0,
    }),
    [
      name,
      shortDescription,
      description,
      imageUrl,
      imageGradient,
      weightingType,
      rebalanceFrequency,
      constituents,
      displayName,
      userProfile,
    ]
  );

  const setWeighting = (type) => {
    setWeightingType(type);
    if (type === 'equal') setConstituents((prev) => applyEqualWeights(prev));
  };

  const addStock = (stock) => {
    setConstituents((prev) => {
      const next = [
        ...prev,
        {
          ...stock,
          weight: 0,
          segment: stock.isCustom ? 'Custom' : 'Largecap',
        },
      ];
      return weightingType === 'equal' ? applyEqualWeights(next) : next;
    });
    setStockQuery('');
  };

  const addCustomSymbol = () => {
    if (!canAddCustomSymbol) return;
    addStock(buildCustomStock(stockQuery));
  };

  const handleStockQueryKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const selected = new Set(constituents.map((c) => c.symbol));

    if (exactUniverseMatch && !selected.has(exactUniverseMatch.symbol)) {
      addStock(exactUniverseMatch);
      return;
    }

    if (filteredStocks.length === 1) {
      addStock(filteredStocks[0]);
      return;
    }

    addCustomSymbol();
  };

  const removeStock = (symbol) => {
    setConstituents((prev) => {
      const next = prev.filter((c) => c.symbol !== symbol);
      return weightingType === 'equal' ? applyEqualWeights(next) : next;
    });
  };

  const updateWeight = (symbol, weight) => {
    setConstituents((prev) =>
      prev.map((c) => (c.symbol === symbol ? { ...c, weight: Number(weight) || 0 } : c))
    );
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const validateStep = (index) => {
    if (index === 0 && !name.trim()) {
      setError('Basket name is required.');
      return false;
    }
    if (index === 2) {
      if (constituents.length < 2) {
        setError('Add at least 2 stocks.');
        return false;
      }
      if (weightingType === 'custom' && Math.abs(weightTotal - 100) > 0.1) {
        setError(`Custom weights must total 100% (currently ${weightTotal.toFixed(1)}%).`);
        return false;
      }
    }
    setError('');
    return true;
  };

  const goNext = () => {
    if (!validateStep(stepIndex)) return;
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError('');
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const goToPreview = () => {
    setError('');
    setStepIndex(STEPS.length - 1);
  };

  const handleSubmit = () => {
    if (atBasketLimit) {
      setError(`You can create up to ${MAX_USER_BASKETS} baskets. Delete one to add another.`);
      return;
    }
    if (!validateStep(0) || !validateStep(2)) {
      setStepIndex(validateStep(0) ? 2 : 0);
      return;
    }

    const basket = {
      ...draftBasket,
      id: isEditing ? editBasket.id : createBasketId(),
      name: name.trim(),
      shortDescription:
        shortDescription.trim() || description.trim().slice(0, 120) || name.trim(),
      creator: isEditing
        ? editBasket.creator || {
            name: displayName,
            bio: userProfile?.bio || 'Independent basket creator on PocketEdge.',
            avatarUrl: userProfile?.avatarUrl || '',
            links: userProfile?.links || [],
            followers: editBasket.followers ?? 0,
          }
        : {
            name: displayName,
            bio: userProfile?.bio || 'Independent basket creator on PocketEdge.',
            avatarUrl: userProfile?.avatarUrl || '',
            links: userProfile?.links || [],
            followers: 0,
          },
      createdAt: isEditing ? editBasket.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      saveUserBasket(basket);
    } catch (err) {
      setError(err.message || `You can create up to ${MAX_USER_BASKETS} baskets.`);
      return;
    }
    onCreated?.();
    setSaved(true);
    setTimeout(() => navigateApp({ tab: 'basket', basketId: basket.id }), 800);
  };

  if (atBasketLimit) {
    return (
      <AppPageLayout center className="pb-4 max-w-lg text-center">
        <p className="text-sm text-neutral-500">Basket limit reached.</p>
        <button
          type="button"
          onClick={() => navigateApp({ tab: 'create', createNew: false })}
          className="mt-4 text-sm font-semibold text-neutral-900 hover:text-neutral-600"
        >
          ← Back to your baskets
        </button>
      </AppPageLayout>
    );
  }

  if (isEditing && !editBasket) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-6">
        <h2 className="text-xl font-bold text-neutral-900">Basket not found</h2>
        <p className="text-sm text-neutral-500 mt-2">
          This basket may have been removed or you don&apos;t have permission to edit it.
        </p>
        <button
          type="button"
          onClick={() => navigateApp({ tab: 'create', createNew: false })}
          className="mt-6 text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Back to your baskets
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-neutral-900/10 flex items-center justify-center mb-4">
          <Check className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">
          {isEditing ? 'Basket updated!' : 'Basket created!'}
        </h2>
        <p className="text-neutral-500 text-sm mt-2">Opening your basket...</p>
      </div>
    );
  }

  return (
    <AppPageLayout center className="pb-4">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigateApp({ tab: 'create', createNew: false })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Your baskets
        </button>

        <PageHeader
          eyebrow={isEditing ? 'Edit' : undefined}
          title={isEditing ? 'Edit basket' : 'New basket'}
          align="center"
          className="!mb-0"
          description={`Step ${stepIndex + 1} of ${STEPS.length} — ${step.label}`}
        />
        {step.id !== 'preview' && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={goToPreview}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-pe-border/80 text-sm font-medium text-pe-text-secondary hover:text-pe-text hover:border-neutral-300 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          </div>
        )}
      </div>

      <StepIndicator steps={STEPS} currentIndex={stepIndex} onStepClick={(i) => {
        if (i < stepIndex) {
          setError('');
          setStepIndex(i);
        } else if (i === stepIndex + 1) {
          goNext();
        } else if (i === STEPS.length - 1) {
          goToPreview();
        }
      }} />

      {step.id === 'basics' && (
        <section className="pe-card p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="pe-section-title text-base">Basket basics</h2>
            <p className="pe-body-s mt-1">
              Name your basket and explain the investment idea.
            </p>
          </div>

          <Field label="Basket name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI Infrastructure Play"
              className="pe-input"
            />
          </Field>

          <Field label="Short description">
            <input
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="One line summary for search cards"
              className="pe-input"
            />
          </Field>

          <Field label="Full description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Investment rationale, strategy, and who it's for..."
              rows={5}
              className="pe-input resize-none"
            />
          </Field>

          <Field label="Rebalance frequency">
            <select
              value={rebalanceFrequency}
              onChange={(e) => setRebalanceFrequency(e.target.value)}
              className="pe-input"
            >
              {REBALANCE_FREQUENCIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </section>
      )}

      {step.id === 'cover' && (
        <section className="pe-card p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="pe-section-title text-base">Cover image</h2>
            <p className="pe-body-s mt-1">
              Upload a photo or pick a gradient — this appears as the basket thumbnail.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Field label="Upload image">
                <label className="flex flex-col items-center justify-center w-full aspect-[16/10] rounded-xl border-2 border-dashed border-neutral-300 cursor-pointer hover:border-neutral-300 transition-colors overflow-hidden bg-neutral-50">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-6">
                      <ImagePlus className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                      <span className="text-sm text-neutral-500">Click to upload</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </Field>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="mt-2 text-xs text-neutral-500 hover:text-rose-500"
                >
                  Remove image
                </button>
              )}
            </div>

            <div>
              <Field label="Or choose a gradient">
                <div className="grid grid-cols-2 gap-3">
                  {GRADIENTS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setImageGradient(g);
                        setImageUrl('');
                      }}
                      className={`aspect-[16/10] rounded-xl bg-gradient-to-br ${g} ${
                        imageGradient === g && !imageUrl
                          ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </Field>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-3 uppercase tracking-wide">Live thumbnail</p>
            <div className="max-w-xs pointer-events-none">
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-neutral-200/80">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${imageGradient}`} />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {step.id === 'stocks' && (
        <div className="space-y-4">
          <section className="pe-card p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="pe-section-title text-base">Weighting</h2>
              <p className="pe-body-s mt-1">How should stocks be allocated?</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WeightOption
                active={weightingType === 'equal'}
                title="Equal weighted"
                desc="Same % in each stock"
                onClick={() => setWeighting('equal')}
              />
              <WeightOption
                active={weightingType === 'custom'}
                title="Custom weighted"
                desc="Set your own allocation"
                onClick={() => setWeighting('custom')}
              />
            </div>
          </section>

          <section className="pe-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="pe-section-title text-base">Constituents</h2>
                <p className="pe-body-s mt-0.5">Add at least 2 stocks — search or enter a custom symbol</p>
              </div>
              {weightingType === 'custom' && (
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    Math.abs(weightTotal - 100) < 0.1
                      ? 'bg-neutral-100 text-neutral-900'
                      : 'bg-amber-500/15 text-amber-700'
                  }`}
                >
                  Total: {weightTotal.toFixed(1)}%
                </span>
              )}
            </div>

            <div className="relative">
              <input
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                onKeyDown={handleStockQueryKeyDown}
                placeholder="Search or enter a ticker symbol (e.g. AAPL, BRK.B)"
                className="pe-input"
                autoComplete="off"
                spellCheck={false}
              />
              {showStockSuggestions && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-xl">
                  {filteredStocks.slice(0, 5).map((s) => (
                    <li key={s.symbol}>
                      <button
                        type="button"
                        onClick={() => addStock(s)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
                      >
                        <span className="text-neutral-900 font-medium">{s.symbol}</span>
                        <span className="text-neutral-500 truncate flex-1 text-right">{s.name}</span>
                        <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                      </button>
                    </li>
                  ))}
                  {canAddCustomSymbol && (
                    <li className="border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={addCustomSymbol}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
                      >
                        <span className="text-neutral-900 font-medium">{normalizedStockQuery}</span>
                        <span className="text-neutral-500 truncate flex-1 text-right">Add custom symbol</span>
                        <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">{IBKR_SYMBOL_NOTE}</p>

            {constituents.length === 0 && (
              <p className="text-sm text-neutral-400 italic py-2">
                No stocks added yet — pick from suggestions or press Enter to add a custom symbol.
              </p>
            )}

            <ul className="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
              {constituents.map((c) => (
                <li
                  key={c.symbol}
                  className="flex items-center gap-2 bg-neutral-50 rounded-xl px-3 py-2.5 border border-neutral-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900">{c.symbol}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {c.isCustom ? 'Custom symbol · verify on IBKR' : c.name}
                    </div>
                  </div>
                  {weightingType === 'custom' ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={c.weight}
                      onChange={(e) => updateWeight(c.symbol, e.target.value)}
                      className="w-16 bg-white border border-neutral-200/80 rounded-lg px-2 py-1 text-sm text-right text-neutral-900"
                    />
                  ) : (
                    <span className="text-sm text-emerald-600 font-medium w-16 text-right">
                      {c.weight}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeStock(c.symbol)}
                    className="p-1.5 text-neutral-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {step.id === 'preview' && (
        <section className="pe-card p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="pe-section-title text-base">Preview your basket</h2>
            <p className="pe-body-s mt-1">
              See how it appears in search and on the detail page before publishing.
            </p>
          </div>
          <BasketPreviewPanel basket={draftBasket} />
        </section>
      )}

      {error && (
        <p className="text-sm text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between pt-2">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-neutral-200/80 text-sm font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {step.id === 'preview' ? (
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold transition-colors"
          >
            <Check className="w-4 h-4" />
            {isEditing ? 'Save changes' : 'Publish basket'}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold transition-colors"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </AppPageLayout>
  );
}

function StepIndicator({ steps, currentIndex, onStepClick }) {
  return (
    <nav aria-label="Create basket steps" className="pe-card p-4 sm:p-5">
      <ol className="flex items-start">
        {steps.map((s, index) => {
          const Icon = s.icon;
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <React.Fragment key={s.id}>
              <li className="flex flex-col items-center min-w-0 w-16 sm:w-20 shrink-0">
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  disabled={index > currentIndex + 1}
                  className="flex flex-col items-center gap-2 disabled:cursor-default"
                >
                  <span
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      active
                        ? 'bg-neutral-900 border-neutral-900 text-white'
                        : done
                          ? 'bg-neutral-100 border-neutral-300 text-neutral-900'
                          : 'bg-neutral-50 border-neutral-200/80 text-neutral-400'
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </span>
                  <span
                    className={`text-[10px] sm:text-xs font-medium text-center leading-tight ${
                      active ? 'text-neutral-900' : 'text-neutral-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              </li>
              {index < steps.length - 1 && (
                <li
                  className={`flex-1 h-0.5 mt-5 mx-1 sm:mx-2 rounded-full ${
                    index < currentIndex ? 'bg-neutral-900' : 'bg-neutral-200'
                  }`}
                  aria-hidden
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="pe-label text-[10px] mb-1.5 block">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function WeightOption({ active, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all ${
        active
          ? 'border-neutral-900/30 bg-neutral-900/5'
          : 'border-neutral-200/80 bg-neutral-50 hover:border-neutral-300'
      }`}
    >
      <div className="pe-card-title">{title}</div>
      <div className="pe-body-s text-pe-text-muted mt-1">{desc}</div>
    </button>
  );
}
