export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Source = 'user' | 'llm_text' | 'llm_image';

export interface Entry {
  id: string;
  occurred_at: string;
  meal_type: MealType;
  item_name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  source: Source;
  confidence?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AddFoodEntryInput {
  occurred_at: string;
  meal_type: MealType;
  item_name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  notes?: string;
  confidence?: number;
}
export interface AddFoodEntryOutput { id: string }

export interface UpdateFoodEntryInput {
  id: string;
  fields: Partial<Omit<AddFoodEntryInput, 'confidence'>>;
}
export interface UpdateFoodEntryOutput { updated: true }

export interface DeleteFoodEntryInput { id: string }
export interface DeleteFoodEntryOutput { deleted: true }

export interface ListEntriesInput { from?: string; to?: string }
export interface ListEntriesOutput { entries: Entry[] }

export type ChatSseEventName = 'token' | 'tool_call' | 'tool_result' | 'message' | 'done' | 'error';

export interface TokenEvent { type: 'token'; content: string }
export interface ToolCallEvent { type: 'tool_call'; name: string; arguments: unknown }
export interface ToolResultEvent { type: 'tool_result'; name: string; result: unknown }
export interface AssistantMessageEvent { type: 'message'; id: string; session_id: string; role: 'assistant'; content: string; created_at: string }
export interface DoneEvent { type: 'done'; usage?: { input_tokens?: number; output_tokens?: number }; finish_reason?: string }
export interface ErrorEvent { type: 'error'; code: string; message: string }
export type ChatSseEvent = TokenEvent | ToolCallEvent | ToolResultEvent | AssistantMessageEvent | DoneEvent | ErrorEvent;

