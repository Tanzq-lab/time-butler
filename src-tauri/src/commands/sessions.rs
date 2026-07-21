use serde::Serialize;
use sqlx::{Row, SqlitePool};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

const REASSIGNMENT_FAILED_MESSAGE: &str = "无法更正这个番茄，请稍后重试。";

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletedPomoReassignment {
    source_task_id: Option<i64>,
    source_category_id: Option<i64>,
    target_task_id: i64,
    target_category_id: Option<i64>,
}

fn database_error(context: &str, error: sqlx::Error) -> String {
    eprintln!("[sessions] {context}: {error}");
    REASSIGNMENT_FAILED_MESSAGE.to_string()
}

async fn reassign_completed_pomo_in_pool(
    pool: &SqlitePool,
    session_id: i64,
    target_task_id: i64,
) -> Result<CompletedPomoReassignment, String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| database_error("failed to begin pomodoro reassignment", error))?;

    let record = sqlx::query(
        r#"
        SELECT
          s.task_id AS source_task_id,
          s.category_id AS source_category_id,
          target.category_id AS target_category_id
        FROM sessions s
        JOIN tasks target ON target.id = ? AND target.archived = 0
        WHERE s.id = ?
          AND s.phase = 'work'
          AND s.completed = 1
          AND s.pomo_counted = 1
        "#,
    )
    .bind(target_task_id)
    .bind(session_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| database_error("failed to load pomodoro reassignment", error))?
    .ok_or_else(|| "只能更正已完成且已计入统计的专注番茄。".to_string())?;

    let source_task_id = record
        .try_get::<Option<i64>, _>("source_task_id")
        .map_err(|error| database_error("failed to decode source task", error))?;
    let source_category_id = record
        .try_get::<Option<i64>, _>("source_category_id")
        .map_err(|error| database_error("failed to decode source category", error))?;
    let target_category_id = record
        .try_get::<Option<i64>, _>("target_category_id")
        .map_err(|error| database_error("failed to decode target category", error))?;

    if source_task_id == Some(target_task_id) {
        return Err("该番茄已经属于这个任务。".to_string());
    }

    let update = sqlx::query(
        r#"
        UPDATE sessions
        SET task_id = ?,
            category_id = ?
        WHERE id = ?
          AND phase = 'work'
          AND completed = 1
          AND pomo_counted = 1
          AND task_id IS ?
        "#,
    )
    .bind(target_task_id)
    .bind(target_category_id)
    .bind(session_id)
    .bind(source_task_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| database_error("failed to update pomodoro attribution", error))?;

    if update.rows_affected() != 1 {
        return Err("该番茄已被更新，请刷新日历后重试。".to_string());
    }

    if let Some(source_task_id) = source_task_id {
        sqlx::query(
            "UPDATE tasks SET completed_pomos = MAX(0, completed_pomos - 1) WHERE id = ?",
        )
        .bind(source_task_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| database_error("failed to decrement source task pomodoros", error))?;
    }

    sqlx::query("UPDATE tasks SET completed_pomos = completed_pomos + 1 WHERE id = ?")
        .bind(target_task_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| database_error("failed to increment target task pomodoros", error))?;

    if let Some(source_task_id) = source_task_id {
        sqlx::query(
            r#"
            INSERT INTO task_activity_log (task_id, action, from_value, to_value)
            VALUES
              (?, 'completed_pomo_reassigned_out', ?, ?),
              (?, 'completed_pomo_reassigned_in', ?, ?)
            "#,
        )
        .bind(source_task_id)
        .bind(session_id.to_string())
        .bind(target_task_id.to_string())
        .bind(target_task_id)
        .bind(session_id.to_string())
        .bind(source_task_id.to_string())
        .execute(&mut *transaction)
        .await
        .map_err(|error| database_error("failed to record pomodoro reassignment", error))?;
    } else {
        sqlx::query(
            r#"
            INSERT INTO task_activity_log (task_id, action, from_value)
            VALUES (?, 'completed_pomo_assigned_from_standalone', ?)
            "#,
        )
        .bind(target_task_id)
        .bind(session_id.to_string())
        .execute(&mut *transaction)
        .await
        .map_err(|error| database_error("failed to record standalone pomodoro assignment", error))?;
    }

    transaction
        .commit()
        .await
        .map_err(|error| database_error("failed to commit pomodoro reassignment", error))?;

    Ok(CompletedPomoReassignment {
        source_task_id,
        source_category_id,
        target_task_id,
        target_category_id,
    })
}

#[tauri::command]
pub async fn reassign_completed_pomo(
    db_instances: State<'_, DbInstances>,
    db: String,
    session_id: i64,
    target_task_id: i64,
) -> Result<CompletedPomoReassignment, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances.get(&db) {
            Some(DbPool::Sqlite(pool)) => pool.clone(),
            None => return Err(REASSIGNMENT_FAILED_MESSAGE.to_string()),
        }
    };

    reassign_completed_pomo_in_pool(&pool, session_id, target_task_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_pool(include_activity_log: bool) -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database should open");

        sqlx::query(
            r#"
            CREATE TABLE tasks (
              id INTEGER PRIMARY KEY,
              archived INTEGER NOT NULL DEFAULT 0,
              category_id INTEGER,
              completed_pomos INTEGER NOT NULL DEFAULT 0
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            r#"
            CREATE TABLE sessions (
              id INTEGER PRIMARY KEY,
              task_id INTEGER,
              phase TEXT NOT NULL,
              completed INTEGER NOT NULL,
              pomo_counted INTEGER NOT NULL,
              category_id INTEGER
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        if include_activity_log {
            sqlx::query(
                r#"
                CREATE TABLE task_activity_log (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  task_id INTEGER NOT NULL,
                  action TEXT NOT NULL,
                  from_value TEXT,
                  to_value TEXT
                )
                "#,
            )
            .execute(&pool)
            .await
            .unwrap();
        }

        sqlx::query(
            "INSERT INTO tasks (id, category_id, completed_pomos) VALUES (12, 48, 1), (13, 69, 0)",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            r#"
            INSERT INTO sessions (id, task_id, phase, completed, pomo_counted, category_id)
            VALUES
              (93, 12, 'work', 1, 1, 48),
              (94, NULL, 'work', 1, 1, NULL)
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[test]
    fn moves_attribution_counters_and_activity_in_one_transaction() {
        tauri::async_runtime::block_on(async {
            let pool = setup_pool(true).await;

            let result = reassign_completed_pomo_in_pool(&pool, 93, 13)
                .await
                .unwrap();

            assert_eq!(
                result,
                CompletedPomoReassignment {
                    source_task_id: Some(12),
                    source_category_id: Some(48),
                    target_task_id: 13,
                    target_category_id: Some(69),
                }
            );

            let session = sqlx::query("SELECT task_id, category_id FROM sessions WHERE id = 93")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(session.get::<i64, _>("task_id"), 13);
            assert_eq!(session.get::<i64, _>("category_id"), 69);

            let counts = sqlx::query("SELECT id, completed_pomos FROM tasks ORDER BY id")
                .fetch_all(&pool)
                .await
                .unwrap();
            assert_eq!(counts[0].get::<i64, _>("completed_pomos"), 0);
            assert_eq!(counts[1].get::<i64, _>("completed_pomos"), 1);

            let activity_count = sqlx::query("SELECT COUNT(*) AS count FROM task_activity_log")
                .fetch_one(&pool)
                .await
                .unwrap()
                .get::<i64, _>("count");
            assert_eq!(activity_count, 2);
        });
    }

    #[test]
    fn rolls_back_every_write_when_activity_logging_fails() {
        tauri::async_runtime::block_on(async {
            let pool = setup_pool(false).await;

            assert!(reassign_completed_pomo_in_pool(&pool, 93, 13)
                .await
                .is_err());

            let session_task_id = sqlx::query("SELECT task_id FROM sessions WHERE id = 93")
                .fetch_one(&pool)
                .await
                .unwrap()
                .get::<i64, _>("task_id");
            assert_eq!(session_task_id, 12);

            let counts = sqlx::query("SELECT id, completed_pomos FROM tasks ORDER BY id")
                .fetch_all(&pool)
                .await
                .unwrap();
            assert_eq!(counts[0].get::<i64, _>("completed_pomos"), 1);
            assert_eq!(counts[1].get::<i64, _>("completed_pomos"), 0);
        });
    }

    #[test]
    fn assigns_a_standalone_pomodoro_without_decrementing_another_task() {
        tauri::async_runtime::block_on(async {
            let pool = setup_pool(true).await;

            let result = reassign_completed_pomo_in_pool(&pool, 94, 13)
                .await
                .unwrap();

            assert_eq!(
                result,
                CompletedPomoReassignment {
                    source_task_id: None,
                    source_category_id: None,
                    target_task_id: 13,
                    target_category_id: Some(69),
                }
            );

            let session = sqlx::query("SELECT task_id, category_id FROM sessions WHERE id = 94")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(session.get::<i64, _>("task_id"), 13);
            assert_eq!(session.get::<i64, _>("category_id"), 69);

            let counts = sqlx::query("SELECT id, completed_pomos FROM tasks ORDER BY id")
                .fetch_all(&pool)
                .await
                .unwrap();
            assert_eq!(counts[0].get::<i64, _>("completed_pomos"), 1);
            assert_eq!(counts[1].get::<i64, _>("completed_pomos"), 1);

            let action = sqlx::query("SELECT action FROM task_activity_log")
                .fetch_one(&pool)
                .await
                .unwrap()
                .get::<String, _>("action");
            assert_eq!(action, "completed_pomo_assigned_from_standalone");
        });
    }
}
