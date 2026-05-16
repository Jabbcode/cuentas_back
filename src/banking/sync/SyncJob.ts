import * as bankConnectionRepo from '../../repositories/bankConnection.repository.js';
import { SyncOrchestrator } from './SyncOrchestrator.js';
import { createTrueLayerAdapter } from '../providers/truelayer/TrueLayerAdapter.js';

export async function run(): Promise<void> {
  const provider = createTrueLayerAdapter();
  const orchestrator = new SyncOrchestrator(provider);

  const connections = await bankConnectionRepo.findAllActive();

  for (const connection of connections) {
    try {
      await orchestrator.sync(connection);
    } catch {
      // Errors in individual connections should not stop the rest of the job
    }
  }
}
