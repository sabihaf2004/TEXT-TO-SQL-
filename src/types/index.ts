export interface TableColumn {
  name: string;
  type: string;
  isPrimary?: boolean;
  isForeign?: boolean;
  references?: string;
  description?: string;
}

export interface TableSchema {
  tableName: string;
  description: string;
  columns: TableColumn[];
  rowCount: number;
}

export interface ClarificationOption {
  id: string;
  label: string;
  description: string;
  sqlHint?: string;
}

export interface AmbiguityAnalysis {
  isAmbiguous: boolean;
  ambiguityScore: number;
  ambiguityType: string;
  detectedAmbiguousTokens: string[];
  explanation: string;
  clarifyingQuestion?: string;
  options?: ClarificationOption[];
  resolvedIntent?: string;
}

export interface SafetyCheckResult {
  name: string;
  passed: boolean;
  details: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedSql: string;
  formattedSql: string;
  tablesUsed: string[];
  safetyChecks: SafetyCheckResult[];
}

export interface SqlDetails {
  raw: string;
  sanitized: string;
  formatted: string;
  explanation: string;
  assumptions: string[];
  validation: ValidationResult;
}

export interface ExecutionDetails {
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeMs: number;
}

export interface AnswerInsight {
  headline: string;
  summary: string;
  keyMetrics: { label: string; value: string }[];
  suggestedFollowUps: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  type?: 'clarification_prompt' | 'sql_result' | 'validation_error' | 'execution_error' | 'text';
  ambiguityAnalysis?: AmbiguityAnalysis;
  clarifyingQuestion?: string;
  options?: ClarificationOption[];
  selectedOptionId?: string;
  sql?: SqlDetails;
  execution?: ExecutionDetails;
  answer?: AnswerInsight;
  error?: string;
  safetyChecks?: SafetyCheckResult[];
}
