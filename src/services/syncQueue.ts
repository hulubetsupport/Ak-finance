import { db } from './db.ts';
import { PaymentRecord, AppSettings } from '../types/index.ts';

type SyncListener = () => void;

class SyncQueueEngine {
  private timerId: number | null = null;
  private isProcessing = false;
  private listeners: Set<SyncListener> = new Set();
  private isOnline = navigator.onLine;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.processQueue();
        this.notifyListeners();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners();
      });

      // Listen for Capacitor / Android native broadcast SMS events
      window.addEventListener('ak_sms_received', (event: any) => {
        const detail = event?.detail;
        if (detail && detail.message) {
          this.handleIncomingSms(detail.sender || 'Unknown', detail.message, 'sms');
        }
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('Error in sync listener', err);
      }
    });
  }

  public async start(): Promise<void> {
    const settings = await db.getSettings();
    this.stop();

    if (settings.mode === 'server') {
      const intervalMs = Math.max(5, settings.retryIntervalSeconds || 15) * 1000;
      this.timerId = window.setInterval(() => {
        this.processQueue();
      }, intervalMs);
      // Run once immediately
      this.processQueue();
    }
  }

  public stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public async handleIncomingSms(sender: string, message: string, source: 'sms' | 'simulated' = 'sms'): Promise<PaymentRecord> {
    const payment = await db.ingestIncomingSms(sender, message, source);
    this.notifyListeners();

    const settings = await db.getSettings();
    if (settings.mode === 'server') {
      // Immediate attempt
      this.syncSinglePayment(payment, settings);
    }
    return payment;
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const settings = await db.getSettings();
      if (settings.mode === 'local') {
        this.isProcessing = false;
        return;
      }

      const pendingList = await db.getPendingQueue();
      if (pendingList.length === 0) {
        this.isProcessing = false;
        return;
      }

      for (const item of pendingList) {
        await this.syncSinglePayment(item, settings);
      }
    } catch (err) {
      console.error('Error in processQueue', err);
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }

  public async syncSinglePayment(payment: PaymentRecord, settings?: AppSettings): Promise<boolean> {
    if (!settings) {
      settings = await db.getSettings();
    }

    if (settings.mode === 'local') {
      return false;
    }

    const startTime = Date.now();
    const serverUrl = settings.serverUrl?.trim();
    if (!serverUrl) {
      await db.updatePaymentStatus(payment.id, 'failed', undefined, 'Missing Server URL in settings');
      return false;
    }

    const payload = {
      action: 'save_sms',
      token: settings.secretKey || '',
      sender: payment.senderAddress,
      message: payment.rawMessage,
      // Supplemental parsed fields for reconciliation:
      bank: payment.bank,
      type: payment.type,
      amount: payment.amount,
      currency: payment.currency,
      counterparty: payment.counterparty,
      reference: payment.reference,
      balance: payment.balance,
      timestamp: payment.timestamp,
    };

    try {
      let response: Response;
      const isPost = settings.httpMethod === 'POST';

      if (isPost) {
        response = await fetch(serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else {
        // GET method: append query parameters
        const url = new URL(serverUrl);
        url.searchParams.set('action', 'save_sms');
        url.searchParams.set('token', settings.secretKey || '');
        url.searchParams.set('sender', payment.senderAddress);
        url.searchParams.set('message', payment.rawMessage);
        url.searchParams.set('amount', String(payment.amount));
        url.searchParams.set('ref', payment.reference);

        response = await fetch(url.toString(), {
          method: 'GET',
        });
      }

      const durationMs = Date.now() - startTime;
      const responseText = await response.text();

      if (response.ok || response.status === 200) {
        await db.updatePaymentStatus(payment.id, 'sent', responseText);
        await db.addSyncLog({
          timestamp: Date.now(),
          paymentId: payment.id,
          status: 'success',
          httpStatus: response.status,
          url: serverUrl,
          message: `Synced ${payment.bank} ${payment.type} (${payment.amount} ETB). Server: ${responseText.substring(0, 100)}`,
          durationMs,
        });
        this.notifyListeners();
        return true;
      } else {
        const err = `HTTP ${response.status}: ${responseText.substring(0, 100) || response.statusText}`;
        await db.updatePaymentStatus(payment.id, 'failed', responseText, err);
        await db.addSyncLog({
          timestamp: Date.now(),
          paymentId: payment.id,
          status: 'failed',
          httpStatus: response.status,
          url: serverUrl,
          message: err,
          durationMs,
        });
        this.notifyListeners();
        return false;
      }
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error?.message || 'Network connection failed';
      await db.updatePaymentStatus(payment.id, 'failed', undefined, errorMsg);
      await db.addSyncLog({
        timestamp: Date.now(),
        paymentId: payment.id,
        status: 'failed',
        url: serverUrl,
        message: `Offline or network failure: ${errorMsg}`,
        durationMs,
      });
      this.notifyListeners();
      return false;
    }
  }

  public getNetworkStatus(): boolean {
    return this.isOnline;
  }
}

export const syncQueue = new SyncQueueEngine();
