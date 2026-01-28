# exercises_rows.csv audit

Input: `database/exercises_rows.csv`
Output (Supabase import): `database/exercises_rows.supabase.csv`

## Summary

- Rows: **100**
- Columns: **19**
- Duplicate names (case/space-insensitive): **3**

## Missingness (% empty/NULL)

| column | missing % |
|---|---:|
| last_synced_at | 100.0 |
| gif_url | 100.0 |
| created_by | 100.0 |
| description | 68.0 |
| difficulty | 68.0 |
| exercisedb_id | 30.0 |
| image_url | 15.0 |
| tips | 15.0 |
| video_url | 15.0 |
| is_custom | 0.0 |
| created_at | 0.0 |
| id | 0.0 |
| is_compound | 0.0 |
| name | 0.0 |
| instructions | 0.0 |
| equipment_needed | 0.0 |
| muscle_groups | 0.0 |
| category | 0.0 |
| sync_status | 0.0 |

## Array column import readiness (converted to Postgres text[] literals)

| column | empty rows | valid JSON rows | invalid JSON rows |
|---|---:|---:|---:|
| equipment_needed | 0 | 100 | 0 |
| muscle_groups | 0 | 100 | 0 |
| tips | 15 | 85 | 0 |
| instructions | 0 | 100 | 0 |