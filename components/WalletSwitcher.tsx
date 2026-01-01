
import React from 'react';
import { Wallet } from '../types';

interface WalletSwitcherProps {
  wallets: Wallet[];
  activeWalletId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

const WalletSwitcher: React.FC<WalletSwitcherProps> = ({ wallets, activeWalletId, onSelect, onAdd, onDelete }) => {
  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
      {wallets.map((wallet) => (
        <div key={wallet.id} className="flex items-center group">
          <button
            onClick={() => onSelect(wallet.id)}
            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border whitespace-nowrap flex items-center gap-3 ${
              activeWalletId === wallet.id
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            <i className={`fas ${activeWalletId === wallet.id ? 'fa-wallet' : 'fa-vault'} text-[10px]`}></i>
            {wallet.name}
          </button>
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
        title="Add New Wallet Profile"
      >
        <i className="fas fa-plus"></i>
      </button>
    </div>
  );
};

export default WalletSwitcher;
