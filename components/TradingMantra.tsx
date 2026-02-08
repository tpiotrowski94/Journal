
import React, { useState, useEffect } from 'react';
import { Wallet, TradingPillar } from '../types';

interface TradingMantraProps {
  activeWallet: Wallet;
  onUpdateWallet: (data: Partial<Wallet>) => void;
}

const ICON_OPTIONS = [
  "fa-chart-line", "fa-shield-halved", "fa-eye", "fa-clock", 
  "fa-ban", "fa-bolt", "fa-brain", "fa-check-double",
  "fa-triangle-exclamation", "fa-layer-group", "fa-bullseye", "fa-microchip",
  "fa-arrow-trend-up", "fa-magnifying-glass-chart", "fa-water", "fa-fire"
];

const DEFAULT_PILLARS: TradingPillar[] = [
  { title: "Trendline", description: "Is the trendline on HTF confirmed?", icon: "fa-chart-line", color: "emerald" },
  { title: "Indicators", description: "Indicators in confluence zone (RSI/MACD)", icon: "fa-microchip", color: "amber" },
  { title: "Liquidation", description: "Check liquidation heatmaps and SL levels", icon: "fa-shield-halved", color: "blue" }
];

const DEFAULT_MANTRA = "My strategy is based on trendlines, indicators, and liquidation levels. I do not enter without full confirmation.";

const TradingMantra: React.FC<TradingMantraProps> = ({ activeWallet, onUpdateWallet }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{ 
    mantra: string, 
    pillars: TradingPillar[],
    showMantra: boolean,
    showPillars: boolean 
  }>({
    mantra: '',
    pillars: [],
    showMantra: true,
    showPillars: true
  });

  useEffect(() => {
    if (activeWallet) {
      setEditData({
        mantra: activeWallet.mantra || DEFAULT_MANTRA,
        pillars: activeWallet.pillars || DEFAULT_PILLARS,
        showMantra: activeWallet.showMantra !== undefined ? activeWallet.showMantra : true,
        showPillars: activeWallet.showPillars !== undefined ? activeWallet.showPillars : true
      });
    }
  }, [activeWallet]);

  if (!activeWallet) return null;

  const handleSave = () => {
    onUpdateWallet(editData);
    setIsEditing(false);
  };

  const updatePillar = (idx: number, field: keyof TradingPillar, val: string) => {
    const newPillars = [...editData.pillars];
    newPillars[idx] = { ...newPillars[idx], [field]: val };
    setEditData({ ...editData, pillars: newPillars });
  };

  const addPillar = () => {
    setEditData({
      ...editData,
      pillars: [...editData.pillars, { title: "New Rule", description: "Requirement...", icon: "fa-check-double", color: "slate" }]
    });
  };

  const removePillar = (idx: number) => {
    const newPillars = editData.pillars.filter((_, i) => i !== idx);
    setEditData({ ...editData, pillars: newPillars });
  };

  const showMantra = activeWallet.showMantra !== undefined ? activeWallet.showMantra : true;
  const showPillars = activeWallet.showPillars !== undefined ? activeWallet.showPillars : true;

  return (
    <div className="mb-6">
      {isEditing ? (
        <div className="bg-slate-800 border-2 border-blue-600 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none">Trading Plan Config</h3>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={editData.showMantra} 
                    onChange={e => setEditData({...editData, showMantra: e.target.checked})}
                    className="w-3 h-3 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">Description</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={editData.showPillars} 
                    onChange={e => setEditData({...editData, showPillars: e.target.checked})}
                    className="w-3 h-3 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">Checklist</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase bg-slate-900/50 rounded-lg hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2 bg-blue-600 rounded-lg text-[9px] font-black text-white uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all">Save Plan</button>
            </div>
          </div>

          <div className="space-y-6">
            {editData.showMantra && (
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700">
                <label className="block text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <i className="fas fa-scroll"></i> Strategy & Mantra
                </label>
                <textarea 
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-xs font-medium h-24 outline-none focus:ring-1 focus:ring-blue-500 shadow-inner resize-y"
                  value={editData.mantra}
                  onChange={e => setEditData({ ...editData, mantra: e.target.value })}
                  placeholder="Describe your general trading approach..."
                />
              </div>
            )}

            {editData.showPillars && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {editData.pillars.map((p, i) => (
                  <div key={i} className="p-3 bg-slate-900 border border-slate-700 rounded-xl space-y-3 relative group/pillar">
                    <button 
                      onClick={() => removePillar(i)}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-[8px] shadow-lg border border-slate-800 hover:scale-110 transition-transform"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                    <input 
                      className="w-full bg-slate-800 rounded-md px-2 py-1.5 text-white font-black uppercase text-[10px] outline-none border border-transparent focus:border-blue-500" 
                      value={p.title} 
                      onChange={e => updatePillar(i, 'title', e.target.value)}
                      placeholder="Title"
                    />
                    <textarea 
                      className="w-full bg-slate-800 rounded-md px-2 py-1.5 text-[10px] text-slate-400 font-medium outline-none h-14 resize-y border border-transparent focus:border-blue-500" 
                      value={p.description}
                      onChange={e => updatePillar(i, 'description', e.target.value)}
                      placeholder="Description..."
                    />
                    <div className="grid grid-cols-8 gap-0.5">
                      {ICON_OPTIONS.map(iconName => (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => updatePillar(i, 'icon', iconName)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-all ${p.icon === iconName ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600 hover:text-slate-400'}`}
                        >
                          <i className={`fas ${iconName} text-[7px]`}></i>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={addPillar} className="min-h-[120px] border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/5 transition-all">
                  <i className="fas fa-plus-circle text-lg"></i>
                  <span className="text-[7px] font-black uppercase tracking-widest">Add Requirement</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch ${(!showMantra && !showPillars) ? 'hidden' : ''}`}>
          {showMantra && (
            <div 
              onClick={() => setIsEditing(true)}
              className={`${showPillars ? 'md:col-span-4' : 'md:col-span-12'} group relative bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 flex flex-col cursor-pointer hover:bg-slate-800/50 hover:border-blue-500/30 transition-all shadow-md overflow-hidden min-h-[100px]`}
            >
              <div className="absolute top-3 right-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <i className="fas fa-pen-to-square text-[10px]"></i>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Strategy & Psychology</p>
              </div>
              <div className="flex-1">
                <p className="text-[13px] text-slate-200 font-bold leading-relaxed italic tracking-tight whitespace-pre-wrap break-words">
                  "{activeWallet.mantra || DEFAULT_MANTRA}"
                </p>
              </div>
            </div>
          )}

          {showPillars && (
            <div 
              onClick={() => setIsEditing(true)}
              className={`${showMantra ? 'md:col-span-8' : 'md:col-span-12'} group relative bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex flex-col cursor-pointer hover:bg-slate-900/50 hover:border-emerald-500/30 transition-all shadow-md`}
            >
              <div className="absolute top-3 right-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <i className="fas fa-pen-to-square text-[10px]"></i>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-[1px] bg-emerald-500/30 rounded-full"></span>
                <h3 className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em]">Setup Checklist</h3>
              </div>
              <div className={`grid grid-cols-1 ${showMantra ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'} gap-3`}>
                {(activeWallet.pillars || DEFAULT_PILLARS).length > 0 ? (activeWallet.pillars || DEFAULT_PILLARS).map((p, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-slate-900/40 border border-slate-800/40 rounded-xl">
                    <div className="w-7 h-7 min-w-[28px] rounded-lg bg-emerald-500/5 flex items-center justify-center border border-emerald-500/10">
                      <i className={`fas ${p.icon || 'fa-check-double'} text-emerald-500 text-[11px]`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-[9px] uppercase italic tracking-tight leading-tight truncate">{p.title}</p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase leading-tight mt-0.5 line-clamp-2">
                        {p.description}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-4 text-center text-slate-600 text-[8px] font-black uppercase tracking-widest italic opacity-40">
                    No rules defined.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {(!isEditing && !showMantra && !showPillars) && (
        <div className="w-full py-4 flex justify-center">
           <button onClick={() => setIsEditing(true)} className="px-6 py-2 bg-slate-800 border border-slate-700 rounded-xl text-[8px] font-black text-slate-500 uppercase tracking-widest hover:text-blue-400 hover:border-blue-500/50 transition-all">
             <i className="fas fa-plus-circle mr-2"></i> Configure Trading Plan
           </button>
        </div>
      )}
    </div>
  );
};

export default TradingMantra;
