
import { useState, useEffect, useCallback } from 'react';
import { Wallet, SyncProvider, Transfer } from '../types';
import { dataService } from '../services/dataService';

export const useWalletManager = () => {
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [activeWalletId, setActiveWalletId] = useState<string>('');

    useEffect(() => {
        const loaded = dataService.loadWallets();
        if (loaded.length > 0) {
            setWallets(loaded);
            const active = dataService.getActiveWalletId() || loaded[0].id;
            setActiveWalletId(active);
        } else {
            const defaultWallet: Wallet = {
                id: crypto.randomUUID(),
                name: 'Main Portfolio',
                provider: SyncProvider.MANUAL,
                initialBalance: 0,
                balanceAdjustment: 0
            };
            setWallets([defaultWallet]);
            setActiveWalletId(defaultWallet.id);
            dataService.saveWallets([defaultWallet]);
            dataService.setActiveWalletId(defaultWallet.id);
        }
    }, []);

    const updateWallet = useCallback((id: string, data: Partial<Wallet>) => {
        setWallets(prev => {
            const updated = prev.map(w => w.id === id ? { ...w, ...data } : w);
            dataService.saveWallets(updated);
            return updated;
        });
    }, []);

    const addWallet = useCallback((w: Wallet) => {
        setWallets(prev => {
            const updated = [...prev, w];
            dataService.saveWallets(updated);
            return updated;
        });
    }, []);

    const deleteWallet = useCallback((id: string) => {
        setWallets(prev => {
            if (prev.length <= 1) return prev;
            const updated = prev.filter(w => w.id !== id);
            dataService.saveWallets(updated);
            if (activeWalletId === id) setActiveWalletId(updated[0].id);
            return updated;
        });
        dataService.deleteTrades(id);
    }, [activeWalletId]);

    const setActive = useCallback((id: string) => {
        setActiveWalletId(id);
        dataService.setActiveWalletId(id);
    }, []);

    const addTransfer = useCallback((walletId: string, transfer: Transfer) => {
        setWallets(prev => {
            const updated = prev.map(w => w.id === walletId ? {
                ...w,
                transfers: [...(w.transfers || []), transfer]
            } : w);
            dataService.saveWallets(updated);
            return updated;
        });
    }, []);

    const deleteTransfer = useCallback((walletId: string, transferId: string) => {
        setWallets(prev => {
            const updated = prev.map(w => w.id === walletId ? {
                ...w,
                transfers: (w.transfers || []).filter(t => t.id !== transferId)
            } : w);
            dataService.saveWallets(updated);
            return updated;
        });
    }, []);

    const activeWallet = wallets.find(w => w.id === activeWalletId);

    return {
        wallets,
        activeWalletId,
        activeWallet,
        updateWallet,
        addWallet,
        deleteWallet,
        setActiveWalletId: setActive,
        addTransfer,
        deleteTransfer
    };
};
