import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { ConversationsController } from './controllers/conversations.controller.js';
import { HealthController } from './controllers/health.controller.js';
import { MessagesController } from './controllers/messages.controller.js';
import { SseController } from './controllers/sse.controller.js';
import { SuggestionsController } from './controllers/suggestions.controller.js';
import { CoreLifecycleService } from './core-lifecycle.service.js';
import { IdentityGuard } from './middleware/identity.js';
import { SseBroadcaster } from './services/sse/broadcaster.js';
import { SseService } from './services/sse/sse.service.js';
import { MessageProcessingService } from './services/message-processing/index.js';

@Module({
  imports: [HostModule],
  controllers: [
    HealthController,
    ConversationsController,
    MessagesController,
    SseController,
    SuggestionsController,
  ],
  providers: [
    CoreLifecycleService,
    IdentityGuard,
    SseBroadcaster,
    SseService,
    MessageProcessingService,
  ],
})
export class AppModule {}
