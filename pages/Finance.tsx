
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DetailedAnalytics } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { TrendingUp, ArrowUpCircle, ArrowDownCircle, BrainCircuit, CloudRain, Loader2 } from 'lucide-react';

const Finance: React.FC = () => {
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await api.getDetailedAnalytics();
        setAnalytics(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    loadData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      <p className="mt-4 text-gray-500">{t('loading')}</p>
    </div>
  );

  if (!analytics) return <div className="p-10 text-center">{t('noData')}</div>;

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-black text-gray-800 border-b-2 border-green-500 pb-2 flex items-center gap-2">
        <TrendingUp className="text-green-600" />
        {t('finance')}
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-green-100 shadow-sm flex flex-col items-center text-center">
            <ArrowUpCircle className="w-8 h-8 text-green-500 mb-2" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('totalIncome')}</span>
            <span className="text-2xl font-black text-green-600">₹{analytics.total_income}</span>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-red-100 shadow-sm flex flex-col items-center text-center">
            <ArrowDownCircle className="w-8 h-8 text-red-500 mb-2" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('totalExpense')}</span>
            <span className="text-2xl font-black text-red-600">₹{analytics.total_expense}</span>
        </div>
      </div>

      {/* Net Profit Feature */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-green-100 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-32 h-32" />
          </div>
          <span className="text-sm font-bold opacity-80 uppercase tracking-widest">{t('netProfit')}</span>
          <h3 className="text-5xl font-black mt-1">₹{analytics.net_profit}</h3>
      </div>

      {/* AI Prediction Section */}
      <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-200 flex items-center gap-5">
        <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-lg shadow-blue-200">
          <BrainCircuit className="w-10 h-10" />
        </div>
        <div>
          <h4 className="text-blue-900 font-black text-lg">{t('aiProfitPrediction')}</h4>
          <p className="text-blue-700 text-sm leading-tight">{t('aiPredictionSub')}</p>
          <p className="text-2xl font-black text-blue-800 mt-1">₹{analytics.predicted_profit}</p>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-800 mb-4 uppercase tracking-tighter">{t('profitTrend')}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.monthly_trends}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
              <Tooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="profit" fill="#10b981" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expense Pie Chart */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-800 mb-4 uppercase tracking-tighter">{t('expenseDistribution')}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={analytics.category_expenses}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {analytics.category_expenses.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weather Profit Analysis */}
      <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-200 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-3">
          <CloudRain className="w-6 h-6 text-indigo-600" />
          <h4 className="font-black text-indigo-900">{t('weatherProfitInsight')}</h4>
        </div>
        <p className="text-sm text-indigo-800 leading-relaxed mb-4">
          {t('weatherProfitSub')} Our analysis shows a <b>{(analytics.weather_correlation * 100).toFixed(0)}%</b> positive correlation.
        </p>
        <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
          <div className="bg-indigo-600 h-full" style={{ width: `${analytics.weather_correlation * 100}%` }}></div>
        </div>
      </div>
    </div>
  );
};

export default Finance;
