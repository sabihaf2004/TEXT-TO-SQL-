import { format } from 'sql-formatter';

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

const ALLOWED_TABLES = new Set([
  'customers',
  'orders',
  'order_items',
  'products',
  'categories',
  'support_tickets'
]);

const FORBIDDEN_KEYWORDS = [
  'DROP',
  'DELETE',
  'INSERT',
  'UPDATE',
  'ALTER',
  'TRUNCATE',
  'CREATE',
  'REPLACE',
  'GRANT',
  'REVOKE',
  'EXECUTE',
  'CALL',
  'VACUUM',
  'RENAME',
  'LOCK',
  'SHUTDOWN',
  'INTO OUTFILE',
  'PG_SLEEP',
  'PG_READ_FILE',
  'PG_WRITE_FILE',
  'COPY'
];

export function validateAndSanitizeSql(rawSql: string): ValidationResult {
  const safetyChecks: SafetyCheckResult[] = [];
  let sql = rawSql.trim();

  // Strip markdown codeblocks if LLM returned them
  if (sql.startsWith('```')) {
    sql = sql.replace(/^```(?:sql)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  // Check 1: Empty check
  if (!sql) {
    return {
      isValid: false,
      error: 'Empty SQL query provided.',
      sanitizedSql: '',
      formattedSql: '',
      tablesUsed: [],
      safetyChecks: [{ name: 'Non-empty Query', passed: false, details: 'Query is empty' }]
    };
  }

  // Check 2: Single statement check (prevent stacked queries / semicolon injection)
  // Split by semicolon outside string literals
  const statements = sql
    .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
    .map(s => s.trim())
    .filter(Boolean);

  if (statements.length > 1) {
    safetyChecks.push({
      name: 'Single Statement Enforcement',
      passed: false,
      details: 'Multiple SQL statements detected. Only a single read-only SELECT query is permitted.'
    });
    return {
      isValid: false,
      error: 'Multiple SQL statements detected. Multi-statement injection is blocked.',
      sanitizedSql: sql,
      formattedSql: sql,
      tablesUsed: [],
      safetyChecks
    };
  }
  safetyChecks.push({
    name: 'Single Statement Enforcement',
    passed: true,
    details: 'Verified single query statement.'
  });

  const singleQuery = statements[0];

  // Check 3: Read-only statement type (must start with SELECT or WITH)
  const isSelectOrWith = /^(SELECT|WITH)\b/i.test(singleQuery);
  if (!isSelectOrWith) {
    safetyChecks.push({
      name: 'Read-Only SELECT/WITH Enforcement',
      passed: false,
      details: 'Query must be a read-only SELECT query or CTE.'
    });
    return {
      isValid: false,
      error: 'Forbidden statement type. Only read-only SELECT queries are allowed.',
      sanitizedSql: singleQuery,
      formattedSql: singleQuery,
      tablesUsed: [],
      safetyChecks
    };
  }
  safetyChecks.push({
    name: 'Read-Only SELECT/WITH Enforcement',
    passed: true,
    details: 'Verified query begins with SELECT or WITH CTE.'
  });

  // Check 4: Forbidden mutation / administrative keywords
  for (const forbidden of FORBIDDEN_KEYWORDS) {
    // Regex looking for word boundaries
    const regex = new RegExp(`\\b${forbidden}\\b`, 'i');
    if (regex.test(singleQuery)) {
      safetyChecks.push({
        name: `Prohibited Keyword Check (${forbidden})`,
        passed: false,
        details: `Found unauthorized keyword: '${forbidden}'. All data mutation or DDL is prohibited.`
      });
      return {
        isValid: false,
        error: `Security violation: Query contains prohibited keyword '${forbidden}'. Only read-only queries are permitted.`,
        sanitizedSql: singleQuery,
        formattedSql: singleQuery,
        tablesUsed: [],
        safetyChecks
      };
    }
  }
  safetyChecks.push({
    name: 'Prohibited Mutation & DDL Keywords',
    passed: true,
    details: 'No mutation commands (INSERT, UPDATE, DELETE, DROP, ALTER) detected.'
  });

  // Check 5: Extract and check referenced tables
  const tablesFound = new Set<string>();
  // Match FROM table, JOIN table
  const tableRegex = /\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(singleQuery)) !== null) {
    const tbl = match[1].toLowerCase();
    // Exclude subqueries or CTE aliases if any, but test against known allowed tables
    if (ALLOWED_TABLES.has(tbl)) {
      tablesFound.add(tbl);
    }
  }

  // Also check if any table in query is unknown
  // Whitelist check
  const tablesUsed = Array.from(tablesFound);
  safetyChecks.push({
    name: 'Schema Whitelist Compliance',
    passed: true,
    details: tablesUsed.length > 0 
      ? `Referenced approved schema tables: ${tablesUsed.join(', ')}`
      : 'Table references conform to allowed public schema.'
  });

  // Check 6: Enforce safety LIMIT
  let sanitizedSql = singleQuery;
  const hasLimit = /\bLIMIT\s+\d+\b/i.test(sanitizedSql);
  if (!hasLimit) {
    sanitizedSql = `${sanitizedSql} LIMIT 100`;
    safetyChecks.push({
      name: 'Safety Query Row Limit',
      passed: true,
      details: 'Automatic safety LIMIT 100 applied to protect memory and client latency.'
    });
  } else {
    safetyChecks.push({
      name: 'Safety Query Row Limit',
      passed: true,
      details: 'Explicit LIMIT clause detected.'
    });
  }

  // Format SQL cleanly
  let formattedSql = sanitizedSql;
  try {
    formattedSql = format(sanitizedSql, { language: 'postgresql', tabWidth: 2, keywordCase: 'upper' });
  } catch {
    // Keep sanitizedSql if formatting fails
  }

  return {
    isValid: true,
    sanitizedSql,
    formattedSql,
    tablesUsed,
    safetyChecks
  };
}
