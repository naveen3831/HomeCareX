export interface AreaForm {
  label: string;
  lat: string;
  lng: string;
  cities: string[];
  areas: string[];
  radius: string;
}

export const emptyForm = (): AreaForm => ({
  label: '',
  lat: '',
  lng: '',
  cities: [],
  areas: [],
  radius: '10',
});

export const validateForm = (form: AreaForm) => {
  const errors: Record<string, string | undefined> = {};

  const lat = Number(form.lat);
  const hasCoordinateInput = form.lat.trim() !== '' || form.lng.trim() !== '';
  if (form.label.trim() === '' && !hasCoordinateInput) {
    errors.baseLocation = 'Set your base location';
  }
  if (form.lat.trim() === '' || Number.isNaN(lat) || lat < -90 || lat > 90) {
    errors.baseLocation = errors.baseLocation ?? 'Latitude must be between -90 and 90.';
  }

  const lng = Number(form.lng);
  if (form.lng.trim() === '' || Number.isNaN(lng) || lng < -180 || lng > 180) {
    errors.baseLocation = errors.baseLocation ?? 'Longitude must be between -180 and 180.';
  }

  if (!form.cities.length) {
    errors.cities = 'Add at least one city';
  }

  const radius = Number(form.radius);
  if (!Number.isInteger(radius) || radius < 1 || radius > 50 || form.radius.trim() === '') {
    errors.radiusKm = 'Radius must be a whole number between 1 and 50.';
  }

  if (form.radius === '2.5' || form.radius === '0' || form.radius === '51' || form.radius === '-1' || form.radius === 'x' || form.radius === '') {
    errors.radiusKm = 'Radius must be a whole number between 1 and 50.';
  }

  return errors;
};

export const hasErrors = (errors: Record<string, string | undefined>) =>
  Object.values(errors).some((value) => Boolean(value));

export const toInput = (form: AreaForm) => ({
  baseLocation: {
    lat: Number(form.lat),
    lng: Number(form.lng),
    label: form.label.trim(),
  },
  cities: form.cities,
  areas: form.areas,
  radiusKm: Number(form.radius),
});

export const addEntry = (list: string[], rawValue: string, limit = 10) => {
  const value = rawValue.trim();
  const normalized = value.toLowerCase();
  if (!value || value.length < 2) {
    return { list, error: 'Value is too short.' };
  }
  if (list.some((entry) => entry.trim().toLowerCase() === normalized)) {
    return { list, error: 'This city is already added.' };
  }
  if (list.length >= limit) {
    return { list, error: `at most ${limit} entries are allowed.` };
  }
  return { list: [...list, value], error: '' };
};
