import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { closeDatabase } from './db/client.js';
import { getProvider } from './services/ai/index.js';

@Injectable()
export class CoreLifecycleService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    try {
      const provider = await getProvider();
      console.log(
        `[Core] AI: provider ${provider.name} · ${provider.describe()}`,
      );
    } catch (error) {
      console.warn(
        `[Core] ATENÇÃO: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await closeDatabase();
  }
}
