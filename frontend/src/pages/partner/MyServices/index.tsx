import { useEffect, useMemo, useState } from 'react';
import { getPartnerServices, savePartnerServices, type ApprovedService } from './myServices.api';

export const approvedPartnerServices = [
  'AC Repair',
  'AC Service',
  'Washing Machine',
  'Refrigerator',
  'Geyser',
  'Microwave',
  'Water Purifier',
  'Laptop Repair',
] as const;

export const isApprovedPartnerService = (serviceName: string) =>
  approvedPartnerServices.some(
    (service) => service.toLowerCase() === serviceName.trim().toLowerCase(),
  );

export default function PartnerMyServicesPage() {
  const [services, setServices] = useState<ApprovedService[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [savedSelection, setSavedSelection] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPartnerServices();
      const nextSelected = result.selectedIds ?? [];
      setServices(result.approved ?? []);
      setSelected(nextSelected);
      setSavedSelection(nextSelected);
      setDirty(false);
      setSavedMessage(null);
    } catch {
      setError("Couldn't load your services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const isChecked = (id: string) => selected.includes(id);

  const saveChanges = async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      const result = await savePartnerServices(selected);
      const nextSelected = result.selectedIds ?? selected;
      setServices(result.approved ?? []);
      setSelected(nextSelected);
      setSavedSelection(nextSelected);
      setDirty(false);
      setSavedMessage('Services saved.');
    } catch {
      setError('Could not save your services');
    } finally {
      setSaving(false);
    }
  };

  const saved = useMemo(() => savedMessage ?? null, [savedMessage]);

  const toggleSelection = (id: string) => {
    const nextSelected = isChecked(id)
      ? selected.filter((entry) => entry !== id)
      : [...selected, id];
    setSelected(nextSelected);
    setDirty(JSON.stringify([...nextSelected].sort()) !== JSON.stringify([...savedSelection].sort()));
  };

  if (loading) {
    return (<div data-testid="services-loading" aria-label="Loading services">Loading…</div>);
  }

  if (error) {
    return (
      <div>
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  if (!services.length) {
    return <div>No services available yet</div>;
  }

  return (
    <div>
      {saved && <div>{saved}</div>}
      <div>
        {services.map((service) => (
          <label key={service.id} htmlFor={service.id}>
            <input
              id={service.id}
              type="checkbox"
              checked={isChecked(service.id)}
              aria-label={service.name}
              onChange={() => toggleSelection(service.id)}
            />
            {service.name}
          </label>
        ))}
      </div>
      <button type="button" disabled={!dirty || saving} onClick={() => void saveChanges()}>
        {saving ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  );
}
