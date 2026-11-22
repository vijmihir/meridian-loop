// Where each company is, for the map. Known cities first; otherwise the middle of the country.
const CITIES = {
  Tirupur: [11.11, 77.34], Jaipur: [26.91, 75.79], Panipat: [29.39, 76.97], Alappuzha: [9.5, 76.34], Bengaluru: [12.97, 77.59],
  Mumbai: [19.08, 72.88], Delhi: [28.61, 77.21], Kolkata: [22.57, 88.36], Chennai: [13.08, 80.27], Ahmedabad: [23.02, 72.57],
  'Ho Chi Minh City': [10.82, 106.63], Hanoi: [21.03, 105.85], 'Da Nang': [16.05, 108.2], Hue: [16.46, 107.59],
  Gazipur: [24.0, 90.42], Chattogram: [22.36, 91.78], Savar: [23.85, 90.26], Dhaka: [23.81, 90.41],
  Ningbo: [29.87, 121.54], Shaoxing: [30.0, 120.58], Hangzhou: [30.27, 120.16], Shanghai: [31.23, 121.47], Guangzhou: [23.13, 113.26],
  'Phnom Penh': [11.56, 104.93], 'Siem Reap': [13.36, 103.86], Bandung: [-6.92, 107.61], Jakarta: [-6.2, 106.85], Bali: [-8.34, 115.09],
  Ludhiana: [30.9, 75.85], Bhagalpur: [25.24, 86.97], Kannur: [11.87, 75.37], Karur: [10.96, 78.08], Erode: [11.34, 77.72],
  Kandy: [7.29, 80.63], 'Chiang Mai': [18.79, 98.98], 'Hoi An': [15.88, 108.33], 'Nam Dinh': [20.42, 106.17], Narayanganj: [23.62, 90.5], Ashulia: [23.9, 90.3],
  Qingdao: [36.07, 120.38], Suzhou: [31.3, 120.62], 'Kampong Speu': [11.45, 104.52], Yogyakarta: [-7.8, 110.36], Faisalabad: [31.42, 73.08], Sialkot: [32.49, 74.53],
  Kathmandu: [27.72, 85.32], Kalibo: [11.71, 122.37], 'Luang Prabang': [19.89, 102.13], Kurashiki: [34.58, 133.77], Taipei: [25.03, 121.57],
  Sydney: [-33.87, 151.21], Melbourne: [-37.81, 144.96], Copenhagen: [55.68, 12.57], London: [51.51, -0.13], Berlin: [52.52, 13.4], Amsterdam: [52.37, 4.9],
  Dubai: [25.2, 55.27], 'San Francisco': [37.77, -122.42], Toronto: [43.65, -79.38],
  Colombo: [6.93, 79.86], Bangkok: [13.76, 100.5], 'Hong Kong': [22.32, 114.17], Singapore: [1.35, 103.82], Seoul: [37.57, 126.98], Tokyo: [35.68, 139.69],
};
const COUNTRIES = {
  India: [22.5, 79], Vietnam: [16, 107], China: [31, 112], Bangladesh: [23.7, 90.3], Cambodia: [12.5, 104.9], Indonesia: [-2.5, 113],
  'Sri Lanka': [7.8, 80.7], Thailand: [15, 101], 'Hong Kong': [22.32, 114.17], Singapore: [1.35, 103.82],
  Pakistan: [30.4, 70.5], Nepal: [28.2, 84.1], Philippines: [12.9, 122], Laos: [18.5, 103], Japan: [36.2, 138.3], Myanmar: [21, 96], Taiwan: [23.7, 121],
};

export function locate(city, country) {
  const key = Object.keys(CITIES).find((c) => c.toLowerCase() === String(city || '').trim().toLowerCase());
  const at = key ? CITIES[key] : COUNTRIES[country];
  return at ? { lat: at[0], lon: at[1], exact: Boolean(key) } : null;
}
