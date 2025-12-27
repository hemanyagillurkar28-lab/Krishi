
import { CURRENT_FARMER_ID } from '../constants';
import { Activity, Transaction, WeatherAlert, Scheme, WeatherData, ForecastDay, CropRecommendation, DetailedAnalytics, CropInsight } from '../types';

const WEATHER_API_KEY = '384593258ce34c8b945115047250112';

const STORAGE_KEYS = {
  ACTIVITIES: 'krishi_activities',
  TRANSACTIONS: 'krishi_transactions',
  WEATHER_CACHE: 'krishi_weather_cache',
  LOCATION_CACHE: 'krishi_location_cache'
};

const getLocalData = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalData = <T>(key: string, data: T) => {
  const current = getLocalData<T>(key);
  const updated = [data, ...current];
  localStorage.setItem(key, JSON.stringify(updated));
};

const CROP_METADATA = [
  { crop: 'Rice', min_temp: 20, max_temp: 38, min_humidity: 60, rain_needed: true, base_profit: 45000 },
  { crop: 'Wheat', min_temp: 10, max_temp: 25, min_humidity: 40, rain_needed: false, base_profit: 38000 },
  { crop: 'Maize', min_temp: 18, max_temp: 27, min_humidity: 50, rain_needed: true, base_profit: 32000 },
  { crop: 'Sugarcane', min_temp: 21, max_temp: 35, min_humidity: 60, rain_needed: true, base_profit: 85000 },
  { crop: 'Cotton', min_temp: 21, max_temp: 30, min_humidity: 40, rain_needed: false, base_profit: 55000 },
  { crop: 'Pulses', min_temp: 18, max_temp: 30, min_humidity: 30, rain_needed: false, base_profit: 28000 },
];

const calculateCropRecommendations = (temp: number, humidity: number, rain: number): CropRecommendation[] => {
  return CROP_METADATA.map(meta => {
    let suitability: 'High' | 'Medium' | 'Low' = 'Low';
    let reasons: string[] = [];
    const tempOk = temp >= meta.min_temp && temp <= meta.max_temp;
    const humidityOk = humidity >= meta.min_humidity;
    const rainOk = meta.rain_needed ? rain > 0.1 : true; 
    if (tempOk && humidityOk && rainOk) suitability = 'High';
    else if (tempOk || (humidityOk && rainOk)) suitability = 'Medium';
    if (!tempOk) reasons.push(temp < meta.min_temp ? "Temperature too low" : "Temperature too high");
    if (!humidityOk) reasons.push("Humidity too low");
    if (meta.rain_needed && !rainOk) reasons.push("Needs rain");
    return { crop: meta.crop, suitability, reason: reasons.length > 0 ? reasons.join(", ") : "Ideal conditions" };
  }).sort((a, b) => (a.suitability === 'High' ? -1 : a.suitability === 'Medium' && b.suitability === 'Low' ? -1 : 1));
};

export const api = {
  postActivity: async (data: Partial<Activity>) => {
    const newActivity: Activity = {
      id: Date.now(),
      farmer_id: CURRENT_FARMER_ID,
      date: new Date().toISOString().split('T')[0],
      activity_type: data.activity_type || 'General',
      crop: data.crop || 'N/A',
      ...data
    };
    saveLocalData(STORAGE_KEYS.ACTIVITIES, newActivity);
    return { message: "Saved locally" };
  },
  
  getActivities: async () => {
    return getLocalData<Activity>(STORAGE_KEYS.ACTIVITIES);
  },

  postTransaction: async (data: Partial<Transaction>) => {
    const newTransaction: Transaction = {
      id: Date.now(),
      farmer_id: CURRENT_FARMER_ID,
      date: new Date().toISOString().split('T')[0],
      type: data.type || 'EXPENSE',
      category: data.category || 'General',
      amount: data.amount || 0,
      ...data
    };
    saveLocalData(STORAGE_KEYS.TRANSACTIONS, newTransaction);
    return { message: "Saved locally" };
  },

  getDetailedAnalytics: async (): Promise<DetailedAnalytics> => {
    const transactions = getLocalData<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const monthsMap: Record<string, { profit: number; income: number; expense: number }> = {};
    const categoriesMap: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      const monthKey = t.date.substring(0, 7);
      if (!monthsMap[monthKey]) monthsMap[monthKey] = { profit: 0, income: 0, expense: 0 };
      if (t.type === 'INCOME') {
        monthsMap[monthKey].income += t.amount;
        monthsMap[monthKey].profit += t.amount;
        totalIncome += t.amount;
      } else {
        monthsMap[monthKey].expense += t.amount;
        monthsMap[monthKey].profit -= t.amount;
        totalExpense += t.amount;
        categoriesMap[t.category] = (categoriesMap[t.category] || 0) + t.amount;
      }
    });

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_profit: totalIncome - totalExpense,
      monthly_trends: Object.keys(monthsMap).sort().map(m => ({ month: m, ...monthsMap[m] })),
      category_expenses: Object.keys(categoriesMap).map(c => ({ name: c, value: categoriesMap[c] })),
      predicted_profit: Math.round(totalIncome * 0.15), // Simple mock
      weather_correlation: 0.72
    };
  },

  getCropInsights: async (weatherData: WeatherData): Promise<CropInsight[]> => {
    // Determine average forecast humidity and rainfall
    const avgHumidity = weatherData.forecast.reduce((acc, d) => acc + d.humidity, 0) / weatherData.forecast.length;
    const rainChance = weatherData.forecast.reduce((acc, d) => acc + d.chance_of_rain, 0) / weatherData.forecast.length;

    return CROP_METADATA.map(meta => {
      let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
      let riskReason = 'riskNone';
      let profitFactor = 1.0;

      // Logic: If rainfall is needed but chance is low
      if (meta.rain_needed && rainChance < 20) {
        riskLevel = 'High';
        riskReason = 'riskRainfall';
        profitFactor *= 0.7;
      } else if (avgHumidity > 80) {
        riskLevel = 'Medium';
        riskReason = 'riskHumidity';
        profitFactor *= 0.85;
      } else if (Math.random() > 0.7) {
        riskLevel = 'Medium';
        riskReason = 'riskMarket';
        profitFactor *= 0.9;
      }

      const marketTrend: 'Up' | 'Down' | 'Stable' = profitFactor > 1 ? 'Up' : profitFactor < 0.9 ? 'Down' : 'Stable';

      return {
        crop: meta.crop,
        predictedProfit: Math.round(meta.base_profit * profitFactor),
        riskLevel,
        riskReason,
        marketTrend
      };
    });
  },
  
  getWeatherData: async (): Promise<WeatherData> => {
    let lat = 20.5937, lon = 78.9629;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      });
      lat = position.coords.latitude; lon = position.coords.longitude;
      localStorage.setItem(STORAGE_KEYS.LOCATION_CACHE, JSON.stringify({ lat, lon }));
    } catch (e) {
      const cachedLoc = localStorage.getItem(STORAGE_KEYS.LOCATION_CACHE);
      if (cachedLoc) { const p = JSON.parse(cachedLoc); lat = p.lat; lon = p.lon; }
    }
    try {
      const response = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&days=5&aqi=no&alerts=yes`);
      const data = await response.json();
      const result: WeatherData = {
        location_name: data.location.name,
        current_temp: data.current.temp_c,
        current_condition: data.current.condition.text,
        current_icon: data.current.condition.icon,
        alerts: (data.alerts?.alert || []).map((a: any, i: number) => ({ id: i, date: 'Now', message: a.headline, severity: 'high' })),
        forecast: data.forecast.forecastday.map((d: any) => ({
          date: d.date, temp_c: d.day.avgtemp_c, condition: d.day.condition.text,
          icon: d.day.condition.icon, chance_of_rain: d.day.daily_chance_of_rain, humidity: d.day.avghumidity
        })),
        recommendations: calculateCropRecommendations(data.current.temp_c, data.current.humidity, data.current.precip_mm)
      };
      localStorage.setItem(STORAGE_KEYS.WEATHER_CACHE, JSON.stringify(result));
      return result;
    } catch (e) {
      const cached = localStorage.getItem(STORAGE_KEYS.WEATHER_CACHE);
      if (cached) return JSON.parse(cached);
      throw e;
    }
  },
  
  getSchemes: async () => {
    return [
      { id: 1, name: 'PM Kisan Samman Nidhi', description: 'Financial benefit of Rs. 6,000/- per year in three equal installments.' },
      { id: 2, name: 'Pradhan Mantri Fasal Bima Yojana', description: 'Comprehensive insurance cover against crop failure.' },
      { id: 3, name: 'Soil Health Card Scheme', description: 'Testing soil for nutrients and recommending dosage of fertilizers.' },
      { id: 4, name: 'Kisan Credit Card (KCC)', description: 'Timely and adequate credit support to farmers.' },
    ];
  },
};
