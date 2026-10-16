import { useEffect, useState, type KeyboardEvent } from 'react';
import * as osm from '@/components/customer/maps/osm';
import { addEntry, emptyForm, hasErrors, toInput, validateForm, type AreaForm } from './serviceAreaModel';
import { suggestCities } from './indianCities';
import { getServiceArea, saveServiceArea } from './serviceArea.api';

export default function PartnerServiceAreaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<AreaForm>(emptyForm());
  const [cityInput, setCityInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [cityError, setCityError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [selectionIndex, setSelectionIndex] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [locationSummary, setLocationSummary] = useState<string | null>(null);

  const loadArea = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getServiceArea();
      const nextForm = {
        label: data.baseLocation?.label ?? '',
        lat: data.baseLocation ? String(data.baseLocation.lat) : '',
        lng: data.baseLocation ? String(data.baseLocation.lng) : '',
        cities: data.cities ?? [],
        areas: data.areas ?? [],
        radius: String(data.radiusKm ?? 10),
      };
      setForm(nextForm);
      setConfigured(Boolean(data.configured));
    } catch {
      setLoadError("Couldn't load your service area");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadArea();
  }, []);

  const addCity = (value: string) => {
    const result = addEntry(form.cities, value, 10);
    if (result.error) {
      setCityError(result.error);
      return;
    }
    setForm((current) => ({ ...current, cities: result.list }));
    setCityInput('');
    setSuggestions([]);
    setCityError(null);
  };

  const handleSave = async () => {
    const result = validateForm(form);
    if (hasErrors(result)) {
      setError(result.baseLocation || null);
      setCityError(result.cities || null);
      if (result.radiusKm && !result.baseLocation && !result.cities) {
        setError(result.radiusKm);
      }
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveServiceArea(toInput(form));
      setConfigured(true);
      setDialogOpen(true);
      setCityError(null);
    } catch {
      setError('Could not save your service area');
    } finally {
      setSaving(false);
    }
  };

  const handleUseLocation = async () => {
    if (!navigator.geolocation) {
      setLocationNotice('Location services are unavailable on this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const details = await osm.reverseGeocode({ lat, lng });
          const area = details?.area || details?.line1 || 'Current location';
          const city = details?.city || '';
          const state = details?.state || '';
          const summary = [area, city, state].filter(Boolean).join(', ');
          setForm((current) => ({
            ...current,
            label: area === 'Current location' ? current.label || area : area,
            lat: String(lat),
            lng: String(lng),
          }));
          setLocationSummary(summary);
          setLocationNotice('Location fetched successfully');
          setError(null);
        } catch {
          const fallback = 'Current location';
          setLocationSummary(fallback);
          setLocationNotice('Location fetched successfully');
          setForm((current) => ({ ...current, lat: String(lat), lng: String(lng), label: current.label || fallback }));
        }
      },
      (err) => {
        setLocationNotice(err && err.message && /denied/i.test(err.message) ? 'Location permission was denied.' : 'Could not use your current location.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleCityKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!cityInput.trim()) return;
      if (suggestions.length > 0) {
        addCity(suggestions[selectionIndex] ?? suggestions[0]);
        return;
      }
      addCity(cityInput);
    }

    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setSelectionIndex((current) => (current + 1) % suggestions.length);
    }
  };

  if (loading) {
    return <div aria-label="Loading service area">Loading…</div>;
  }

  if (loadError) {
    return <div>{loadError}<button type="button" onClick={() => void loadArea()}>Retry</button></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-panel p-5 shadow-sm">
        {!configured && !form.lat && !form.lng && !form.cities.length ? (
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-ink">Service area not set</h2>
            <p className="mt-1 text-sm text-muted">Set your service area to start receiving nearby job requests.</p>
          </div>
        ) : null}

        {locationNotice && <div>{locationNotice}</div>}
        {locationSummary && <div className="mt-2 text-sm text-muted">{locationSummary}</div>}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            <span>Latitude</span>
            <input
              aria-label="Latitude"
              value={form.lat}
              onChange={(event) => setForm((current) => ({ ...current, lat: event.target.value }))}
              className="rounded-xl border border-line bg-white px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            <span>Longitude</span>
            <input
              aria-label="Longitude"
              value={form.lng}
              onChange={(event) => setForm((current) => ({ ...current, lng: event.target.value }))}
              className="rounded-xl border border-line bg-white px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            <span>Name (optional)</span>
            <input
              aria-label="Name (optional)"
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              className="rounded-xl border border-line bg-white px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            <span>Radius (km)</span>
            <input
              aria-label="Radius"
              value={form.radius}
              onChange={(event) => setForm((current) => ({ ...current, radius: event.target.value }))}
              className="rounded-xl border border-line bg-white px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            <span>Service cities</span>
            <input
              aria-label="Service cities"
              value={cityInput}
              onChange={(event) => {
                const value = event.target.value;
                setCityInput(value);
                setSuggestions(value.trim().length >= 2 ? suggestCities(value, form.cities, 10) : []);
              }}
              onKeyDown={handleCityKeyDown}
              className="rounded-xl border border-line bg-white px-3 py-2"
              placeholder="Type city name"
            />
          </label>

          {suggestions.length > 0 && (
            <ul aria-label="Service city suggestions" role="listbox" className="mt-2 rounded-xl border border-line bg-white p-2">
              {suggestions.map((city, index) => (
                <li key={city}>
                  <button
                    type="button"
                    role="option"
                    aria-label={city}
                    onClick={() => addCity(city)}
                    className={index === selectionIndex ? 'bg-brand-soft' : ''}
                  >
                    {city}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {cityError && <p className="mt-2 text-sm text-red-600">{cityError}</p>}

          <ul aria-label="Service cities added" role="list" className="mt-3 flex flex-wrap gap-2">
            {form.cities.map((city) => (
              <li key={city} className="rounded-full bg-brand-soft px-2 py-1 text-sm text-brand">
                {city}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={handleUseLocation} className="rounded-xl border border-line px-3 py-2 text-sm">
            Use my current location
          </button>
          <button type="button" onClick={handleSave} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white" disabled={saving}>
            {saving ? 'Saving...' : 'Save service area'}
          </button>
        </div>

        {dialogOpen && (
          <div role="dialog" aria-modal="true" className="mt-4 rounded-xl border border-line bg-white p-4">
            <h3 className="text-lg font-semibold text-ink">Service area saved!</h3>
            <p className="mt-2 text-sm text-muted">{form.cities.length} city · {form.radius || 10} km radius</p>
            <button type="button" onClick={() => setDialogOpen(false)} className="mt-3 rounded-xl bg-brand px-4 py-2 text-sm text-white">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
