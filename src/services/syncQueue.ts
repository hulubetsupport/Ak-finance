import { retryNow } from '../utils/nativeBridge.ts';

type SyncListener = () => void;

class SyncQueueEngine {
  private listeners: Set<SyncListener> = new Set();
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners();
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notifyListeners(): void {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('Error in sync listener', err);
      }
    });
  }

  public async start(): Promise<void> {
    // Native SyncJob and KeepAliveService handle background sync in Android OS
  }

  public stop(): void {
    // Cleanup if needed
  }

  public async retryPending(): Promise<void> {
    await retryNow();
    this.notifyListeners();
  }

  public getNetworkStatus(): boolean {
    return this.isOnline;
  }
}

export const syncQueue = new SyncQueueEngine();
