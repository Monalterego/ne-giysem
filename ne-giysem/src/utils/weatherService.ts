import * as Location from 'expo-location';

const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY ?? '';

/** Konum izni ister ve koordinat döner. İzin yoksa/hata olursa null (İstanbul'a düşülür). */
export async function getCoords(): Promise<{ lat: number; lon: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return null;
  }
}

export interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  recommendation: string;
}

function getRecommendation(temp: number): string {
  if (temp < 10) return 'Kalın kıyafetler';
  if (temp < 15) return 'Ara kat giyim';
  if (temp < 20) return 'Hafif ceket';
  if (temp < 25) return 'Hafif kıyafetler';
  return 'İnce yazlık';
}

function iconToEmoji(iconCode: string): string {
  const base = iconCode.slice(0, 2);
  switch (base) {
    case '01': return '☀️';
    case '02': return '⛅';
    case '03': return '☁️';
    case '04': return '☁️';
    case '09': return '🌧️';
    case '10': return '🌦️';
    case '11': return '⛈️';
    case '13': return '❄️';
    case '50': return '🌫️';
    default:   return '🌡️';
  }
}

export async function fetchWeather(lat?: number, lon?: number): Promise<WeatherData> {
  if (!API_KEY) throw new Error('OpenWeatherMap API key eksik. .env dosyasını kontrol et.');
  // Koordinat verildiyse konuma göre, yoksa İstanbul'a düş (izin reddi/hata fallback'i)
  const query = (lat != null && lon != null)
    ? `lat=${lat}&lon=${lon}`
    : `q=Istanbul`;
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${API_KEY}&units=metric&lang=tr`,
  );
  if (!res.ok) throw new Error(`Hava durumu API hatası: ${res.status}`);
  const json = await res.json();
  const temp = Math.round((json as any).main.temp as number);
  const description = (json as any).weather[0].description as string;
  const iconCode    = (json as any).weather[0].icon as string;
  return {
    temp,
    description,
    icon: iconToEmoji(iconCode),
    recommendation: getRecommendation(temp),
  };
}
