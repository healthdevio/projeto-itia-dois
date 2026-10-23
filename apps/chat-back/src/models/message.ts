export interface Message {
  message_id: string;
  message: string;
  date?: string;
  metadata?: string;
  origin: string;
}
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
