
import React, { useState, useEffect, useRef } from 'react';
import { Mic, CheckCircle, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { parseVoiceCommand } from '../services/geminiService';
import { api } from '../services/api';
import { IntentType, ParsedIntent, Language } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

enum VoiceState {
  IDLE = 'IDLE',
  LOADING_PYTHON = 'LOADING_PYTHON',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  CONFIRMATION = 'CONFIRMATION',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

const VoiceCommand: React.FC = () => {
  const [state, setState] = useState<VoiceState>(VoiceState.LOADING_PYTHON);
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<ParsedIntent | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [pyodide, setPyodide] = useState<any>(null);
  const { language, t } = useLanguage();
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const initPython = async () => {
      try {
        // @ts-ignore
        const py = await window.loadPyodide();
        await py.runPythonAsync(`
import json

def determine_query_type(text, lang):
    """
    Python logic to determine if the farmer is asking about money/profit/budget
    """
    text = text.lower()
    
    # Comprehensive cross-lingual keywords for Profit/Money/Budget
    profit_keywords = [
        "profit", "money", "budget", "income", "expense", "balance",
        "मुनाफा", "पैसे", "बजट", "आय", "खर्च", "हिसाब",
        "नफा", "उत्પન્ન", "पैसे", "खर्च", "शिल्लक",
        "નફો", "પૈસા", "આવક", "ખર્ચ", "હિસાબ", "ફાયદો"
    ]
    
    is_profit = any(kw in text for kw in profit_keywords)
    
    return json.dumps({
        "is_profit_query": is_profit,
        "original_text": text,
        "lang": lang
    })
        `);
        setPyodide(py);
        setState(VoiceState.IDLE);
      } catch (e) {
        console.error("Python initialization failed", e);
        setErrorMessage("Python Engine error. Reloading app...");
        setState(VoiceState.ERROR);
      }
    };

    initPython();
  }, []);

  useEffect(() => {
    if (state === VoiceState.LOADING_PYTHON) return;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language; 

      recognitionRef.current.onstart = () => setState(VoiceState.LISTENING);
      
      recognitionRef.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        handleProcessing(text);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Error", event);
        setErrorMessage(t('retry'));
        setState(VoiceState.ERROR);
      };
    } else {
      setErrorMessage(t('errorBrowser'));
      setState(VoiceState.ERROR);
    }
  }, [language, t, state]);

  const startListening = () => {
    if (recognitionRef.current) recognitionRef.current.lang = language;
    setErrorMessage('');
    setTranscript('');
    setParsedData(null);
    try { recognitionRef.current.start(); } catch (e) {
      recognitionRef.current.stop();
      setTimeout(() => recognitionRef.current.start(), 200);
    }
  };

  const stopListening = () => recognitionRef.current.stop();

  const handleProcessing = async (text: string) => {
    setState(VoiceState.PROCESSING);
    try {
      // PYTHON ANALYSIS STEP
      const pythonResultJson = await pyodide.runPythonAsync(`determine_query_type("${text}", "${language}")`);
      const pythonAnalysis = JSON.parse(pythonResultJson);

      // GEMINI ANALYSIS STEP
      const result = await parseVoiceCommand(text, language);
      setParsedData(result);
      
      if (result.intent === IntentType.QUERY) {
        const analytics = await api.getDetailedAnalytics();
        let queryResponse = result.confirmation_message;
        
        // If Python engine detects financial keywords, append financial insights
        if (pythonAnalysis.is_profit_query) {
          const detail = language === Language.ENGLISH 
            ? `. Your net profit is ${analytics.net_profit} rupees. Next month prediction: ${analytics.predicted_profit}.`
            : language === Language.HINDI
            ? `। आपका कुल लाभ ${analytics.net_profit} रुपये है। अगले महीने का अनुमानित लाभ ${analytics.predicted_profit} है।`
            : language === Language.MARATHI
            ? `। तुमचा निव्वळ नफा ${analytics.net_profit} रुपये आहे. पुढच्या महिन्याचा अंदाज ${analytics.predicted_profit} रुपये आहे.`
            : `। તમારો ચોખ્ખો નફો ${analytics.net_profit} રૂપિયા છે. આવતા મહિનાનો અંદાજિત નફો ${analytics.predicted_profit} છે.`;
          queryResponse += detail;
        }
        
        speakConfirmation(queryResponse);
        setState(VoiceState.CONFIRMATION);
      } else {
        speakConfirmation(result.confirmation_message);
        setState(VoiceState.CONFIRMATION);
      }
    } catch (error) {
      setErrorMessage(t('errorGeneric'));
      setState(VoiceState.ERROR);
    }
  };

  const speakConfirmation = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  };

  const confirmAction = async () => {
    if (!parsedData) return;
    if (parsedData.intent === IntentType.QUERY) {
        setState(VoiceState.IDLE);
        return;
    }

    setState(VoiceState.PROCESSING);
    try {
      if (parsedData.intent === IntentType.ACTIVITY) {
        await api.postActivity({
          activity_type: parsedData.data.activity_type || 'General',
          crop: parsedData.data.crop || 'Unknown',
          area_acres: parsedData.data.area,
          date: new Date().toISOString().split('T')[0]
        });
      } else if (parsedData.intent === IntentType.TRANSACTION) {
        await api.postTransaction({
          type: parsedData.data.transaction_type || 'EXPENSE',
          category: parsedData.data.category || 'General',
          amount: parsedData.data.amount || 0,
          date: new Date().toISOString().split('T')[0]
        });
      }
      
      setState(VoiceState.SUCCESS);
      speakConfirmation(t('saved'));
      setTimeout(() => {
        setState(VoiceState.IDLE);
        setTranscript('');
        setParsedData(null);
      }, 3000);
    } catch (e) {
      setErrorMessage(t('errorGeneric'));
      setState(VoiceState.ERROR);
    }
  };

  const renderLoadingPython = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <div className="relative">
        <Loader2 className="w-16 h-16 text-green-600 animate-spin" />
        <Zap className="w-6 h-6 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-800">Krishi Python Engine</h2>
        <p className="text-sm text-gray-500">Initializing Regional AI...</p>
      </div>
    </div>
  );

  const renderIdle = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">{t('speakNow')}</h2>
        <p className="text-gray-500 px-6 font-medium">{t('speakHint')}</p>
        <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100">
           {t('speakHint2')}
        </div>
      </div>
      <div className="relative">
        <div className="absolute inset-0 bg-orange-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
        <button onClick={startListening} className="relative w-36 h-36 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-orange-200 active:scale-95 transition-transform group">
          <Mic className="w-16 h-16 text-white group-hover:scale-110 transition-transform" />
        </button>
      </div>
      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{t('micHint')}</p>
      
      {/* Engine Status */}
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
          <span className="text-[9px] font-black text-blue-800 uppercase tracking-tighter">Python 3.11</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50 border border-green-100">
          <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
          <span className="text-[9px] font-black text-green-800 uppercase tracking-tighter">Gemini 3 Flash</span>
        </div>
      </div>
    </div>
  );

  const renderListening = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-8">
      <h2 className="text-3xl font-black text-green-600 animate-pulse tracking-tighter">{t('listening')}</h2>
      <div className="w-56 h-56 border-8 border-green-500 rounded-full flex items-center justify-center relative">
        <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-30"></div>
        <div className="absolute inset-4 rounded-full bg-green-200 animate-ping opacity-20" style={{animationDelay: '0.2s'}}></div>
        <Mic className="w-24 h-24 text-green-600" />
      </div>
      <button onClick={stopListening} className="bg-red-50 text-red-600 px-10 py-4 rounded-[1.5rem] font-black border-2 border-red-100 active:bg-red-100 transition-colors uppercase tracking-widest text-xs">{t('stop')}</button>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />
      <h2 className="text-xl font-black text-gray-800 tracking-tighter">{t('processing')}</h2>
      <div className="px-6 py-2 bg-gray-100 rounded-full border border-gray-200">
        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Running Logic Engine...</span>
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div className="flex flex-col h-full justify-between pt-4">
      <div className="bg-white p-7 rounded-[2.5rem] shadow-xl border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('confirmTitle')}</h3>
        </div>
        <p className="text-2xl font-bold text-gray-800 mb-8 leading-tight">"{transcript}"</p>
        
        <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 relative overflow-hidden">
          <Zap className="absolute -right-4 -top-4 w-20 h-20 text-blue-200 opacity-30 rotate-12" />
          <h3 className="text-[10px] font-black text-blue-800 mb-2 uppercase tracking-widest flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3" /> {t('aiUnderstood')}
          </h3>
          <p className="text-xl font-black text-blue-900 leading-snug">{parsedData?.confirmation_message}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-8 pb-4">
        <button onClick={() => setState(VoiceState.IDLE)} className="bg-white text-gray-500 border-2 border-gray-100 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest active:bg-gray-50 transition-colors">{t('incorrect')}</button>
        <button onClick={confirmAction} className="bg-green-600 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-green-200 flex items-center justify-center gap-2 active:bg-green-700 transition-all">
          <CheckCircle className="w-5 h-5" /> {parsedData?.intent === IntentType.QUERY ? "OK" : t('correct')}
        </button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center shadow-inner">
        <CheckCircle className="w-16 h-16 text-green-600" />
      </div>
      <div className="text-center">
        <h2 className="text-3xl font-black text-green-800 tracking-tighter">{t('success')}</h2>
        <p className="text-gray-500 font-bold mt-1">{t('saved')}</p>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center shadow-inner">
        <AlertTriangle className="w-12 h-12 text-red-600" />
      </div>
      <h2 className="text-xl font-black text-red-800 text-center px-6 leading-tight uppercase tracking-tighter">{errorMessage}</h2>
      <button onClick={() => {
        if (errorMessage.includes("Python")) window.location.reload();
        else setState(VoiceState.IDLE);
      }} className="bg-red-600 text-white px-12 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl active:bg-red-700 transition-all">{t('retry')}</button>
    </div>
  );

  return (
    <div className="h-full px-2">
      {state === VoiceState.LOADING_PYTHON && renderLoadingPython()}
      {state === VoiceState.IDLE && renderIdle()}
      {state === VoiceState.LISTENING && renderListening()}
      {state === VoiceState.PROCESSING && renderProcessing()}
      {state === VoiceState.CONFIRMATION && renderConfirmation()}
      {state === VoiceState.SUCCESS && renderSuccess()}
      {state === VoiceState.ERROR && renderError()}
    </div>
  );
};

export default VoiceCommand;
