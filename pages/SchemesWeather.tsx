
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { WeatherData, Scheme, CropInsight } from '../types';
import { CloudRain, Info, Sprout, MapPin, Loader2, ChevronRight, Droplets, BrainCircuit, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const SchemesWeather: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'weather' | 'schemes' | 'insights'>('weather');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [insights, setInsights] = useState<CropInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const wData = await api.getWeatherData();
        const [sData, iData] = await Promise.all([
            api.getSchemes(),
            api.getCropInsights(wData)
        ]);
        setWeatherData(wData);
        setSchemes(sData);
        setInsights(iData);
      } catch (e) {
        console.error("Data load failed", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getTranslatedCrop = (cropName: string) => {
    const key = `crop_${cropName}` as any;
    return t(key);
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'High': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'Medium': return <Info className="w-5 h-5 text-orange-500" />;
      default: return <Sprout className="w-5 h-5 text-green-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
        case 'Up': return <TrendingUp className="w-4 h-4 text-green-500" />;
        case 'Down': return <TrendingDown className="w-4 h-4 text-red-500" />;
        default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
        <p className="text-gray-500 font-medium">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4 bg-gray-50">
      {/* Three Segment Tab Header */}
      <div className="flex bg-white shadow-sm border-b sticky top-0 z-20 overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setActiveTab('weather')}
          className={`flex-1 min-w-[100px] py-4 text-center font-bold text-xs transition-colors border-b-4 ${activeTab === 'weather' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-400'}`}
        >
          {t('tabWeather')}
        </button>
        <button 
          onClick={() => setActiveTab('schemes')}
          className={`flex-1 min-w-[100px] py-4 text-center font-bold text-xs transition-colors border-b-4 ${activeTab === 'schemes' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-400'}`}
        >
          {t('tabSchemes')}
        </button>
        <button 
          onClick={() => setActiveTab('insights')}
          className={`flex-1 min-w-[120px] py-4 text-center font-bold text-xs transition-colors border-b-4 ${activeTab === 'insights' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-400'}`}
        >
          {t('tabInsights')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-24">
        {activeTab === 'weather' && (
          <>
            {/* Real-time Weather Hero Section */}
            <section className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2rem] p-7 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-1 text-blue-100 mb-2 bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-md">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-widest">{weatherData?.location_name || t('currentLocation')}</span>
                  </div>
                  <h2 className="text-6xl font-black flex items-start">
                    {weatherData?.current_temp}<span className="text-3xl mt-2 font-light">°C</span>
                  </h2>
                </div>
                {weatherData?.current_icon && (
                  <div className="bg-white/10 p-2 rounded-3xl backdrop-blur-md shadow-inner">
                    <img src={weatherData.current_icon} alt="Weather" className="w-20 h-20" />
                  </div>
                )}
              </div>
              <p className="text-xl font-semibold text-blue-50 capitalize">{weatherData?.current_condition}</p>
            </section>

            {/* 5-Day Horizontal Forecast */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <CloudRain className="w-5 h-5 text-blue-500" />
                  {t('fiveDayForecast')}
                </h3>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x">
                {weatherData?.forecast.map((day, idx) => (
                  <div key={idx} className={`min-w-[110px] p-5 rounded-3xl border shadow-sm flex flex-col items-center snap-start transition-all ${idx === 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                    <span className="text-[10px] font-black uppercase tracking-tighter mb-2 text-gray-400">
                      {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <img src={day.icon} alt="icon" className="w-12 h-12 mb-2" />
                    <span className="text-xl font-bold text-gray-800">{Math.round(day.temp_c)}°</span>
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-blue-500">
                      <Droplets className="w-3 h-3" /> {day.chance_of_rain}%
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6">
             <div className="bg-blue-600 p-6 rounded-[2rem] text-white flex items-center gap-4 shadow-lg relative overflow-hidden">
                <BrainCircuit className="w-12 h-12 opacity-80" />
                <div>
                    <h3 className="text-xl font-black leading-tight">AI Profit & Risk Advisor</h3>
                    <p className="text-blue-100 text-xs font-medium">Predictions based on local weather & market trends</p>
                </div>
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full"></div>
             </div>

             <div className="grid gap-4">
                {insights.map((ins, idx) => (
                  <div key={idx} className={`bg-white p-6 rounded-[2rem] border-2 shadow-sm transition-all relative overflow-hidden ${
                    ins.riskLevel === 'High' ? 'border-red-100' : ins.riskLevel === 'Medium' ? 'border-orange-100' : 'border-green-100'
                  }`}>
                    {/* Header: Crop & Trend */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <h4 className="font-black text-lg text-gray-800">{getTranslatedCrop(ins.crop)}</h4>
                            <div className="flex items-center bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                {getTrendIcon(ins.marketTrend)}
                                <span className="text-[8px] font-black uppercase text-gray-500 ml-1">{t('marketTrend')}</span>
                            </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                            ins.riskLevel === 'High' ? 'bg-red-100 text-red-600' : 
                            ins.riskLevel === 'Medium' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                        }`}>
                            {getRiskIcon(ins.riskLevel)}
                            {ins.riskLevel === 'High' ? t('riskHigh') : ins.riskLevel === 'Medium' ? t('riskMed') : t('riskLow')}
                        </div>
                    </div>

                    {/* Prediction Body */}
                    <div className="flex justify-between items-end">
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">{t('potentialProfit')}</span>
                            <span className="text-2xl font-black text-gray-800">₹{ins.predictedProfit.toLocaleString()}</span>
                            <span className="text-[10px] text-gray-400 font-medium block">/ acre estimated</span>
                        </div>
                        <div className="text-right">
                             <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Risk Factor</span>
                             <span className={`text-xs font-bold leading-tight ${ins.riskLevel === 'High' ? 'text-red-700' : 'text-gray-600'}`}>
                                {t(ins.riskReason as any)}
                             </span>
                        </div>
                    </div>
                    
                    {/* Visual Risk Bar */}
                    <div className="mt-4 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                        <div className={`h-full ${ins.riskLevel === 'High' ? 'w-full bg-red-500' : ins.riskLevel === 'Medium' ? 'w-[60%] bg-orange-500' : 'w-[20%] bg-green-500'}`}></div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'schemes' && (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 px-1">
              <Info className="w-6 h-6 text-orange-500" />
              {t('tabSchemes')}
            </h3>
            <div className="space-y-4">
              {schemes.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                  <h4 className="font-bold text-lg text-gray-800 mb-3 leading-tight">{s.name}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed mb-5">{s.description}</p>
                  <button className="flex items-center gap-1.5 text-green-700 font-extrabold text-xs uppercase tracking-widest">
                    More Info <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchemesWeather;
