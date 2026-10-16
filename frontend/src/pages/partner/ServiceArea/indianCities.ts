export const indianCities = [
  "Adoni",
  "Agra",
  "Ahmedabad",
  "Ajmer",
  "Akola",
  "Aligarh",
  "Allahabad",
  "Ambala",
  "Amritsar",
  "Anantapur",
  "Arrah",
  "Asansol",
  "Aurangabad",
  "Bangalore",
  "Bareilly",
  "Belgaum",
  "Bellary",
  "Bengaluru",
  "Bhavnagar",
  "Bhilai",
  "Bhopal",
  "Bhubaneswar",
  "Bhuj",
  "Bidar",
  "Bihar Sharif",
  "Bikaner",
  "Bilaspur",
  "Bokaro Steel City",
  "Chandigarh",
  "Chennai",
  "Coimbatore",
  "Cuttack",
  "Dehradun",
  "Delhi",
  "Dhanbad",
  "Durgapur",
  "Eluru",
  "Erode",
  "Faridabad",
  "Gaya",
  "Ghaziabad",
  "Goa",
  "Gorakhpur",
  "Gulbarga",
  "Guntur",
  "Gurugram",
  "Guwahati",
  "Gwalior",
  "Hajipur",
  "Haridwar",
  "Hubballi",
  "Hyderabad",
  "Indore",
  "Jabalpur",
  "Jaipur",
  "Jalandhar",
  "Jalgaon",
  "Jammu",
  "Jamshedpur",
  "Jhansi",
  "Jodhpur",
  "Junagadh",
  "Kakinada",
  "Kanpur",
  "Karnal",
  "Kochi",
  "Kolhapur",
  "Kolkata",
  "Kota",
  "Kurnool",
  "Lucknow",
  "Ludhiana",
  "Madurai",
  "Mahbubnagar",
  "Mangalore",
  "Mangaluru",
  "Mathura",
  "Meerut",
  "Mysuru",
  "Nagpur",
  "Nanded",
  "Nashik",
  "Nellore",
  "Noida",
  "Patna",
  "Pondicherry",
  "Pune",
  "Raipur",
  "Rajahmundry",
  "Rajkot",
  "Ranchi",
  "Ratlam",
  "Rourkela",
  "Saharanpur",
  "Salem",
  "Sambalpur",
  "Shivamogga",
  "Shimla",
  "Siliguri",
  "Solapur",
  "Srinagar",
  "Surat",
  "Thane",
  "Thiruvananthapuram",
  "Tiruchirappalli",
  "Tirupati",
  "Udaipur",
  "Vadodara",
  "Varanasi",
  "Vijayawada",
  "Visakhapatnam",
  "Warangal",
  "Yamunanagar",
] as const;

export type IndianCity = (typeof indianCities)[number];

const CityList = indianCities.map((city) => city.toLowerCase());

export const normalizeCity = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const isKnownIndianCity = (value: string) =>
  CityList.includes(normalizeCity(value).toLowerCase());

export const suggestCities = (
  query: string,
  excluded: string[] = [],
  limit = 10,
): string[] => {
  const term = normalizeCity(query).toLowerCase();
  if (term.length < 2) return [];

  const excludedSet = new Set(
    excluded.map((item) => normalizeCity(item).toLowerCase()),
  );

  const scored = indianCities
    .filter((city) => !excludedSet.has(city.toLowerCase()))
    .map((city) => {
      const lower = city.toLowerCase();
      const starts = lower.startsWith(term) ? 0 : 1;
      const index = lower.indexOf(term);
      return {
        city,
        starts,
        index,
      };
    })
    .filter((item) => item.index >= 0)
    .sort(
      (a, b) =>
        a.starts - b.starts ||
        a.index - b.index ||
        a.city.localeCompare(b.city),
    )
    .slice(0, limit)
    .map((item) => item.city);

  return scored;
};

export const findCitySuggestion = (value: string) =>
  suggestCities(value, [], 1)[0] ?? "";

export const MIN_SERVICE_AREA_RADIUS_KM = 1;
export const MAX_SERVICE_AREA_RADIUS_KM = 50;

export const validateServiceAreaRadius = (radius: number | string) => {
  const value = Number(radius);
  if (!Number.isFinite(value)) return "Radius must be a number.";
  if (
    value < MIN_SERVICE_AREA_RADIUS_KM ||
    value > MAX_SERVICE_AREA_RADIUS_KM
  ) {
    return `Radius must be between ${MIN_SERVICE_AREA_RADIUS_KM} and ${MAX_SERVICE_AREA_RADIUS_KM} km.`;
  }
  return "";
};

export default indianCities;
