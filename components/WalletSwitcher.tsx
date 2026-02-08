
import React, { useState } from 'react';
import { Wallet, SyncProvider } from '../types';

interface WalletSwitcherProps {
  wallets: Wallet[];
  activeWalletId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdateWallet: (wallet: Wallet) => void;
}

const WalletSwitcher: React.FC<WalletSwitcherProps> = ({ wallets, activeWalletId, onSelect, onAdd, onDelete, onUpdateWallet }) => {
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWallet) {
      onUpdateWallet(editingWallet);
      setEditingWallet(null);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
      {wallets.map((wallet) => (
        <div key={wallet.id} className="flex items-center group">
          <div className="flex bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden transition-all shadow-lg">
            <button
              onClick={() => onSelect(wallet.id)}
              className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${
                activeWalletId === wallet.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <i className={`fas ${wallet.address ? 'fa-link' : (activeWalletId === wallet.id ? 'fa-wallet' : 'fa-vault')} text-[10px]`}></i>
              {wallet.name}
            </button>
            
            <button 
              onClick={() => setEditingWallet(wallet)}
              className="px-3 border-l border-slate-700/50 text-slate-500 hover:text-blue-400 transition-colors"
              title="Ustawienia Portfela"
            >
              <i className="fas fa-cog text-[10px]"></i>
            </button>
          </div>

          {wallets.length > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(wallet.id); }}
              className="w-0 overflow-hidden group-hover:w-8 group-hover:ml-1 transition-all text-slate-600 hover:text-rose-500"
            >
              <i className="fas fa-times-circle text-sm"></i>
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 border-dashed text-slate-500 hover:text-emerald-500 hover:border-emerald-500/50 transition-all text-xs font-black uppercase"
      >
        <i className="fas fa-plus"></i>
      </button>

      {/* Modal Ustawień Portfela */}
      {editingWallet && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                <i className="fas fa-sliders text-blue-400"></i> Ustawienia Portfela
              </h3>
              <button onClick={() => setEditingWallet(null)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Nazwa Portfela</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:border-blue-500"
                  value={editingWallet.name}
                  onChange={e => setEditingWallet({...editingWallet, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Kapitał Początkowy ($)</label>
                <input 
                  type="number"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:border-blue-500"
                  value={editingWallet.initialBalance}
                  onChange={e => setEditingWallet({...editingWallet, initialBalance: parseFloat(e.target.value) || 0})}
                />
              </div>
              
              <div className="pt-4 border-t border-slate-700">
                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Opcjonalna Synchronizacja</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setEditingWallet({...editingWallet, provider: SyncProvider.MANUAL, autoSync: false})}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${editingWallet.provider === SyncProvider.MANUAL ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
                    >Manualny</button>
                    <button 
                      type="button"
                      onClick={() => setEditingWallet({...editingWallet, provider: SyncProvider.HYPERLIQUID})}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${editingWallet.provider === SyncProvider.HYPERLIQUID ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
                    >Hyperliquid</button>
                  </div>

                  {editingWallet.provider !== SyncProvider.MANUAL && (
                    <div className="animate-in slide-in-from-top-2 duration-200 space-y-3">
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Adres Portfela (0x...)</label>
                        <input 
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-mono text-[10px] outline-none focus:border-blue-500"
                          placeholder="Wklej adres do automatycznego śledzenia..."
                          value={editingWallet.address || ''}
                          onChange={e => setEditingWallet({...editingWallet, address: e.target.value})}
                        />
                      </div>
                      <label className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-700 rounded-xl cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={editingWallet.autoSync}
                          onChange={e => setEditingWallet({...editingWallet, autoSync: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest transition-colors">Włącz Auto-Sync</span>
                          <span className="text-[8px] text-slate-600 uppercase font-bold">Sprawdzaj pozycje co 5 minut</span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingWallet(null)} className="flex-1 py-4 bg-slate-900 text-slate-500 rounded-xl font-black uppercase text-xs">Anuluj</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-blue-600/20">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletSwitcher;
