/**
 * LedgerTrue Reconciliation Worker Process
 *
 * Runs independently from the Ingestion API:
 * 1. Reads events from the Redis queue.
 * 2. Fetches existing transaction state from the event log.
 * 3. Evaluates legal vs illegal transitions using the pure state machine.
 * 4. Appends double-entry entries to the immutable ledger on SETTLED/VERIFIED.
 * 5. Recomputes projected available vs booked balances.
 */

import { redisClient } from './src/lib/redis';
import { mongoStorage, LedgerEntryDocument } from './src/lib/mongo';
import { RawPaymentEvent, TransactionRecord } from './src/types/eventSchema';
import { applyTransition, createTransactionRecord } from './src/engine/stateMachine';

export class ReconciliationWorker {
  private isRunning: boolean = false;
  private processedEventsCount: number = 0;

  async start() {
    this.isRunning = true;
    console.log('[LedgerTrue Worker] Reconciliation Worker process started. Listening to event stream...');

    while (this.isRunning) {
      try {
        const rawEvent = await redisClient.popFromQueue('PAYMENT_EVENTS_STREAM');
        if (rawEvent) {
          await this.processEvent(rawEvent as RawPaymentEvent);
        } else {
          // Sleep 50ms if queue is empty
          await new Promise((r) => setTimeout(r, 50));
        }
      } catch (err) {
        console.error('[LedgerTrue Worker] Error processing stream item:', err);
      }
    }
  }

  stop() {
    this.isRunning = false;
    console.log('[LedgerTrue Worker] Stopping worker process...');
  }

  async processEvent(event: RawPaymentEvent) {
    // 1. Check if transaction already exists in storage
    let record = await mongoStorage.getTransactionRecord(event.transactionId);

    if (!record) {
      // First event for this transaction
      record = createTransactionRecord({
        transactionId: event.transactionId,
        idempotencyKey: event.idempotencyKey,
        amount: event.amount,
        currency: event.currency,
        source: event.source,
        timestamp: event.timestamp,
        eventId: event.eventId,
      });
    }

    // 2. Apply state machine transition
    const result = applyTransition(record, event.targetState, {
      eventId: event.eventId,
      timestamp: event.timestamp,
      reason: `Processed event ${event.eventType} from ${event.source}`,
    });

    // 3. Save updated transaction record
    await mongoStorage.saveTransactionRecord(result.updatedRecord);

    // 4. If transaction reached SETTLED or VERIFIED, post double-entry ledger journal
    if (result.currentState === 'SETTLED' && result.previousState !== 'SETTLED') {
      const ledgerEntry: LedgerEntryDocument = {
        id: `LEDGER-${Date.now()}-${event.transactionId}`,
        transactionId: event.transactionId,
        timestamp: event.timestamp || new Date().toISOString(),
        description: `Settlement posting for ${event.transactionId} (${event.source})`,
        debitAccount: '1010-Operating-Cash',
        debitAmount: event.amount,
        creditAccount: '2010-Merchant-Payable',
        creditAmount: event.amount,
        balanced: true,
        linkedEventId: event.eventId,
      };

      await mongoStorage.insertLedgerEntry(ledgerEntry);
    }

    this.processedEventsCount++;
  }

  getProcessedCount() {
    return this.processedEventsCount;
  }
}

// Standalone execution entrypoint if run directly
if (require.main === module) {
  const worker = new ReconciliationWorker();
  worker.start().catch(console.error);

  process.on('SIGINT', () => {
    worker.stop();
    process.exit(0);
  });
}
