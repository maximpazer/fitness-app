# Functional Fitness Exercises audit

Source: `database/Functional+Fitness+Exercise+Database+(version+2.9).xlsx`
Output (Supabase import): `database/functional_fitness.exercises.supabase.csv`

## Summary

- Source rows read: **3242**
- Output rows written: **3242**
- Duplicate exercise names (case-insensitive) in output: **2**
- YouTube hyperlinks found: short **2013**, in-depth **950**

## Source missingness (top 15)

| column | missing % |
|---|---:|
| Plane Of Motion #3 | 100.0 |
| Movement Pattern #3 | 98.9 |
| Plane Of Motion #2 | 98.4 |
| Movement Pattern #2 | 85.8 |
| Secondary Equipment | 78.8 |
| In-Depth YouTube Explanation | 70.7 |
| Short YouTube Demonstration | 37.9 |
| Tertiary Muscle | 36.9 |
| Secondary Muscle | 12.7 |
| Mechanics | 0.4 |
| Plane Of Motion #1 | 0.1 |
| Movement Pattern #1 | 0.0 |
| Exercise | 0.0 |
| Foot Elevation | 0.0 |
| Body Region | 0.0 |

## Output missingness (top 15)

| column | missing % |
|---|---:|
| image_url | 100.0 |
| last_synced_at | 100.0 |
| gif_url | 100.0 |
| exercisedb_id | 100.0 |
| created_by | 100.0 |
| video_url | 33.7 |
| is_compound | 0.0 |
| tips | 0.0 |
| created_at | 0.0 |
| is_custom | 0.0 |
| id | 0.0 |
| name | 0.0 |
| instructions | 0.0 |
| difficulty | 0.0 |
| equipment_needed | 0.0 |

## Notes

- `instructions` are empty because the source database does not contain step-by-step text.
- `video_url` is populated from the *hyperlink targets* behind the YouTube columns (not the displayed 'Video Demonstration' text).
- `tips` embeds extra metadata (movement patterns, grip, posture, etc.) so you don’t lose richness without changing your table schema.