// Mock database that replaces @tauri-apps/plugin-sql for browser E2E tests.
// Stores everything in memory using plain Maps.

interface Row {
  id: number;
  [col: string]: unknown;
}

const tables = new Map<string, Map<number, Row>>();
const autoInc = new Map<string, number>();
const columnDefaults = new Map<string, Map<string, unknown>>();

(function seedDefaults() {
  const settings = getTable("settings");
  autoInc.set("settings", 1);
  settings.set(1, { id: 1, key: "onboarding_complete", value: "true" });
})();

function getTable(name: string): Map<number, Row> {
  if (!tables.has(name)) {
    tables.set(name, new Map());
    autoInc.set(name, 0);
  }
  return tables.get(name)!;
}

function allRows(name: string): Row[] {
  return Array.from(getTable(name).values());
}

function parseTable(sql: string): string {
  const m = sql.match(
    /(?:FROM|INTO|UPDATE|TABLE(?:\s+IF\s+NOT\s+EXISTS)?)\s+["']?(\w+)/i,
  );
  return m ? m[1].toLowerCase() : "";
}

function parseWhereId(sql: string, params: unknown[]): number | null {
  const m = sql.match(/WHERE\s+id\s*=\s*\$(\d+)/i);
  return m ? Number(params[parseInt(m[1]) - 1]) : null;
}

function applyWhereFilters(rows: Row[], sql: string, up: string, params: unknown[]): Row[] {
  if (!up.includes("WHERE")) return rows;

  let result = rows;
  if (up.includes("ARCHIVED = 0")) result = result.filter((r) => r.archived === 0);
  if (up.includes("RECURRING_TASK_RULES.ENABLED = 1")) {
    result = result.filter((r) => r.enabled === 1);
  }
  if (up.includes("COMPLETED = 1")) result = result.filter((r) => r.completed === 1);
  if (up.includes("COMPLETED = 0")) result = result.filter((r) => r.completed === 0);
  const dateRange = sql.match(
    /DATE\((STARTED_AT|STARTS_AT)\)\s*>=\s*\$(\d+).*DATE\(\1\)\s*<=\s*\$(\d+)/is,
  );
  if (dateRange) {
    const column = dateRange[1].toLowerCase();
    const start = String(params[parseInt(dateRange[2]) - 1] ?? "");
    const end = String(params[parseInt(dateRange[3]) - 1] ?? "");
    result = result.filter((row) => {
      const value = String(row[column] ?? "").slice(0, 10);
      return value >= start && value <= end;
    });
  } else if (up.includes("DATE(STARTED_AT)")) {
    result = [];
  }

  const id = parseWhereId(sql, params);
  if (id) result = result.filter((r) => r.id === id);

  const equalityFilters = Array.from(
    sql.matchAll(/(?:WHERE|AND)\s+(?:\w+\.)?(\w+)\s*=\s*\$(\d+)/gi),
  );
  for (const equality of equalityFilters) {
    const col = equality[1];
    const pIdx = parseInt(equality[2]) - 1;
    if (pIdx < params.length && col !== "id") {
      result = result.filter((r) => r[col] === params[pIdx]);
    }
  }

  return result;
}

function parseCreateDefaults(sql: string): Map<string, unknown> {
  const defaults = new Map<string, unknown>();
  // Use the outermost parentheses so nested CHECK clauses do not truncate
  // later column defaults such as `enabled DEFAULT 1`.
  const bodyStart = sql.indexOf("(");
  const bodyEnd = sql.lastIndexOf(")");
  if (bodyStart < 0 || bodyEnd <= bodyStart) return defaults;

  const lines = sql.slice(bodyStart + 1, bodyEnd).split(",").map((l) => l.trim());
  for (const line of lines) {
    // Skip constraints (FOREIGN KEY, PRIMARY KEY, etc.)
    if (/^(FOREIGN|PRIMARY|UNIQUE|CHECK|CONSTRAINT)/i.test(line)) continue;

    const parts = line.split(/\s+/);
    const colName = parts[0].replace(/["']/g, "");
    if (!colName) continue;

    const defaultMatch = line.match(/DEFAULT\s+(\S+)/i);
    if (defaultMatch) {
      let val = defaultMatch[1];
      // Remove trailing comma
      val = val.replace(/,$/, "");
      // Parse the default value
      if (val === "0") defaults.set(colName, 0);
      else if (val === "1") defaults.set(colName, 1);
      else if (/^\d+$/.test(val)) defaults.set(colName, Number(val));
      else if (val.toUpperCase() === "CURRENT_TIMESTAMP") {
        defaults.set(colName, new Date().toISOString());
      }
      else if (
        val.startsWith("'") &&
        val.endsWith("'") &&
        val !== "'now'"
      ) {
        defaults.set(colName, val.slice(1, -1));
      }
    }
  }
  return defaults;
}

function splitSqlList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts;
}

function matchingParen(sql: string, openIndex: number): number {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  for (let index = openIndex; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      if (char === quote && sql[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function parseInsertLists(sql: string): { columns: string[]; values: string[] } | null {
  const intoMatch = /INSERT(?:\s+OR\s+\w+)?\s+INTO\s+["']?\w+["']?/i.exec(sql);
  if (!intoMatch) return null;
  const columnsStart = sql.indexOf("(", intoMatch.index + intoMatch[0].length);
  const columnsEnd = matchingParen(sql, columnsStart);
  if (columnsStart < 0 || columnsEnd < 0) return null;

  const valuesMatch = /\bVALUES\b/i.exec(sql.slice(columnsEnd + 1));
  if (!valuesMatch) return null;
  const valuesKeywordEnd = columnsEnd + 1 + valuesMatch.index + valuesMatch[0].length;
  const valuesStart = sql.indexOf("(", valuesKeywordEnd);
  const valuesEnd = matchingParen(sql, valuesStart);
  if (valuesStart < 0 || valuesEnd < 0) return null;

  return {
    columns: splitSqlList(sql.slice(columnsStart + 1, columnsEnd)),
    values: splitSqlList(sql.slice(valuesStart + 1, valuesEnd)),
  };
}

function literalValue(token: string, params: unknown[]): unknown {
  const placeholder = token.match(/^\$(\d+)$/);
  if (placeholder) return params[parseInt(placeholder[1]) - 1] ?? null;
  if (/^NULL$/i.test(token)) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
  if (/^'.*'$/s.test(token)) return token.slice(1, -1).replace(/''/g, "'");
  if (/^CURRENT_TIMESTAMP$/i.test(token)) return new Date().toISOString();
  return undefined;
}

export class Database {
  static async load(_name: string): Promise<Database> {
    return new Database();
  }

  async execute(sql: string, params: unknown[] = []) {
    const up = sql.trim().toUpperCase();
    const name = parseTable(sql);

    if (up.startsWith("CREATE TABLE")) {
      getTable(name);
      columnDefaults.set(name, parseCreateDefaults(sql));
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    if (up.startsWith("INSERT")) {
      const tbl = getTable(name);

      // Migration v19 backfills one accurate snapshot for already-completed
      // leaf focus tasks before the completion trigger starts capturing more.
      if (name === "task_completion_reviews" && up.includes("FROM TASKS TASK")) {
        let inserted = 0;
        for (const task of allRows("tasks")) {
          const hasVisibleChildren = allRows("tasks").some(
            (child) => child.parent_id === task.id && child.archived === 0,
          );
          const alreadyCaptured = allRows("task_completion_reviews").some(
            (entry) =>
              entry.task_id === task.id
              && entry.completed_at === task.completed_at,
          );
          if (
            task.item_type !== "focus"
            || !task.completed_at
            || hasVisibleChildren
            || alreadyCaptured
          ) {
            continue;
          }

          const id = (autoInc.get(name) || 0) + 1;
          autoInc.set(name, id);
          tbl.set(id, {
            id,
            task_id: task.id,
            estimated_pomos: task.estimated_pomos,
            actual_pomos: task.completed_pomos,
            review: task.completion_review ?? null,
            completed_at: task.completed_at,
            created_at: new Date().toISOString(),
          });
          inserted += 1;
        }
        return { lastInsertId: 0, rowsAffected: inserted };
      }

      // Migration v18 copies legacy todo rows into the unified task table.
      // INSERT ... SELECT has no VALUES clause, so model it explicitly.
      if (name === "tasks" && up.includes("FROM TODOS TODO")) {
        let inserted = 0;
        for (const todo of allRows("todos")) {
          if (allRows("tasks").some((task) => task.legacy_todo_id === todo.id)) continue;
          const id = (autoInc.get(name) || 0) + 1;
          autoInc.set(name, id);
          tbl.set(id, {
            id,
            name: todo.title,
            estimated_pomos: 1,
            completed_pomos: 0,
            created_at: todo.created_at,
            archived: todo.archived ?? 0,
            completed_at: todo.completed_at ?? null,
            sort_order: Number(todo.sort_order ?? 0) - 100_000,
            item_type: "todo",
            parent_id: null,
            legacy_todo_id: todo.id,
          });
          inserted += 1;
        }
        return { lastInsertId: 0, rowsAffected: inserted };
      }

      const id = (autoInc.get(name) || 0) + 1;
      autoInc.set(name, id);
      const row: Row = { id };

      // Apply schema defaults first
      const defaults = columnDefaults.get(name);
      if (defaults) {
        for (const [col, val] of defaults) {
          row[col] = val;
        }
      }

      // Parse nested VALUES expressions while retaining simple literals.
      const insertLists = parseInsertLists(sql);
      if (insertLists) {
        insertLists.columns.forEach((col, i) => {
          if (col.toLowerCase() === "id") return;
          const token = insertLists.values[i];
          if (!token) return;
          const value = literalValue(token, params);
          if (value !== undefined) row[col] = value;
        });
      }
      tbl.set(id, row);
      return { lastInsertId: id, rowsAffected: 1 };
    }

    if (up.startsWith("UPDATE")) {
      const tbl = getTable(name);
      const id = parseWhereId(sql, params);

      // Upsert for settings table
      if (up.includes("ON CONFLICT")) {
        for (const [, row] of tbl) {
          if (row.key === params[0]) {
            row.value = params[params.length - 1];
            return { lastInsertId: 0, rowsAffected: 1 };
          }
        }
        const newId = (autoInc.get(name) || 0) + 1;
        autoInc.set(name, newId);
        tbl.set(newId, { id: newId, key: params[0], value: params[1] });
        return { lastInsertId: 0, rowsAffected: 1 };
      }

      if (id && tbl.has(id)) {
        const row = tbl.get(id)!;
        // Handle col = col + 1
        const incM = sql.match(/(\w+)\s*=\s*\1\s*\+\s*1/i);
        if (incM) {
          row[incM[1]] = ((row[incM[1]] as number) || 0) + 1;
          return { lastInsertId: 0, rowsAffected: 1 };
        }
        // General SET
        const setM = sql.match(/SET\s+(.+?)(?:\s+WHERE|$)/is);
        if (setM) {
          splitSqlList(setM[1]).forEach((part) => {
            const [col] = part.split("=").map((s) => s.trim());
            const idxM = part.match(/\$(\d+)/);
            if (idxM) {
              row[col] = params[parseInt(idxM[1]) - 1];
              return;
            }
            const value = literalValue(part.slice(part.indexOf("=") + 1).trim(), params);
            if (value !== undefined) row[col] = value;
          });
        }

        // Emulate migration v19's SQLite trigger so browser E2E exercises the
        // same append-only completion history as the desktop database.
        if (
          name === "tasks"
          && up.includes("COMPLETION_REVIEW =")
          && up.includes("DATETIME('NOW', 'LOCALTIME')")
        ) {
          const completedAt = new Date().toISOString();
          row.completed_at = completedAt;
          const hasVisibleChildren = allRows("tasks").some(
            (child) => child.parent_id === row.id && child.archived === 0,
          );
          if (row.item_type === "focus" && !hasVisibleChildren) {
            const history = getTable("task_completion_reviews");
            const historyId =
              (autoInc.get("task_completion_reviews") || 0) + 1;
            autoInc.set("task_completion_reviews", historyId);
            history.set(historyId, {
              id: historyId,
              task_id: row.id,
              estimated_pomos: row.estimated_pomos,
              actual_pomos: row.completed_pomos,
              review: row.completion_review ?? null,
              completed_at: completedAt,
              created_at: completedAt,
            });
          }
        }
        return { lastInsertId: 0, rowsAffected: 1 };
      }
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    if (up.startsWith("DELETE")) {
      const tbl = getTable(name);
      const id = parseWhereId(sql, params);
      if (id && tbl.has(id)) {
        tbl.delete(id);
        return { lastInsertId: 0, rowsAffected: 1 };
      }
      const tm = sql.match(/task_id\s*=\s*\$(\d+)/i);
      if (tm) {
        const tid = Number(params[parseInt(tm[1]) - 1]);
        for (const [rid, row] of tbl) {
          if (row.task_id === tid) tbl.delete(rid);
        }
      }
      const pm = sql.match(/parent_id\s*=\s*\$(\d+)/i);
      if (pm) {
        const parentId = Number(params[parseInt(pm[1]) - 1]);
        for (const [rid, row] of tbl) {
          if (row.parent_id === parentId) tbl.delete(rid);
        }
      }
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    if (up.startsWith("ALTER TABLE")) {
      const cm = sql.match(/ADD\s+COLUMN\s+(\w+)/i);
      if (cm) {
        const defaultMatch = sql.match(/DEFAULT\s+('(?:[^']|'')*'|-?\d+(?:\.\d+)?|NULL)/i);
        const defaultValue = defaultMatch
          ? literalValue(defaultMatch[1], [])
          : null;
        const defaults = columnDefaults.get(name) ?? new Map<string, unknown>();
        defaults.set(cm[1], defaultValue);
        columnDefaults.set(name, defaults);
        for (const row of getTable(name).values()) {
          if (!(cm[1] in row)) row[cm[1]] = defaultValue;
        }
      }
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    return { lastInsertId: 0, rowsAffected: 0 };
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const up = sql.trim().toUpperCase();
    const name = parseTable(sql);

    if (name === "_schema_meta") {
      const tbl = getTable(name);
      const vrow = Array.from(tbl.values()).find((r) => r.key === "version");
      return (vrow ? [{ value: vrow.value }] : []) as T[];
    }

    if (up.includes("COUNT(*)")) {
      const countCol = (sql.match(/COUNT\(\*\)\s+AS\s+(\w+)/i) || [])[1] ?? "count";
      let rows = allRows(name);

      rows = applyWhereFilters(rows, sql, up, params);

      return [{ [countCol]: rows.length }] as T[];
    }

    if (
      up.includes("SUM(") ||
      up.includes("COUNT(") ||
      up.includes("AVG(") ||
      up.includes("COALESCE")
    ) {
      return [] as T[];
    }

    let rows = allRows(name);

    rows = applyWhereFilters(rows, sql, up, params);

    return rows as T[];
  }
}

export default Database;
