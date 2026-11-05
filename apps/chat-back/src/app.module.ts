import { Module } from '@nestjs/common';
import { ConversationsController } from './controllers/conversations.controller.js';
import { HealthController } from './controllers/health.controller.js';
import { MessagesController } from './controllers/messages.controller.js';
import { SuggestionsController } from './controllers/suggestions.controller.js';
import { CoreLifecycleService } from './core-lifecycle.service.js';
import { IdentityGuard } from './middleware/identity.js';

@Module({
  imports: [],
  controllers: [
    HealthController,
    ConversationsController,
    MessagesController,
    SuggestionsController,
  ],
  providers: [CoreLifecycleService, IdentityGuard],
})
export class AppModule {}
