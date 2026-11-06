import type { ChatConfig } from './chat-config.js';

export interface ChatContext {
    user?: Record<string, unknown>;
    profile?: Record<string, unknown>;
    preferences?: ChatConfig;
    session?: Record<string, unknown>;
    current_page?: string;
    permissions?: string[];
    system_context?: string;
}
