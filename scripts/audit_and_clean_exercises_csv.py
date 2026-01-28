from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
INPUT_CSV = ROOT / "database" / "exercises_rows.csv"
OUTPUT_CSV = ROOT / "database" / "exercises_rows.supabase.csv"
OUTPUT_REPORT_MD = ROOT / "database" / "exercises_rows.audit.md"


ARRAY_COLUMNS = {
    "muscle_groups",
    "equipment_needed",
    "instructions",
    "tips",
}


@dataclass
class ArrayParseStats:
    column: str
    total_rows: int = 0
    empty_rows: int = 0
    valid_json_rows: int = 0
    invalid_json_rows: int = 0


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def _parse_json_array(value: Any) -> tuple[list[str], bool]:
    """Return (items, was_valid_json).

    Accepts JSON array strings like ["A","B"].
    If parsing fails, returns [original_string] (single-item) and was_valid_json=False.
    """
    if _is_empty(value):
        return [], True

    if isinstance(value, list):
        return [str(v) for v in value], True

    text = str(value).strip()
    if text == "":
        return [], True

    # Attempt strict JSON
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(v) for v in parsed if str(v).strip() != ""], True
        # Not a list (unexpected) -> coerce to single item
        return [text], False
    except Exception:
        # Fallback: try to interpret a Postgres array literal already
        if text.startswith("{") and text.endswith("}"):
            inner = text[1:-1].strip()
            if inner == "":
                return [], True
            # very small heuristic split: this is only for already-clean values
            return [s.strip().strip('"') for s in inner.split(",")], True
        return [text], False


def _pg_array_literal(items: Iterable[str]) -> str:
    """Convert a list of strings into a Postgres text[] literal: {"A","B"}."""
    escaped: list[str] = []
    for item in items:
        s = str(item)
        # Escape backslash first, then double quotes
        s = s.replace("\\", "\\\\").replace('"', '\\"')
        escaped.append(f'"{s}"')
    return "{" + ",".join(escaped) + "}"


def main() -> None:
    if not INPUT_CSV.exists():
        raise SystemExit(f"Missing input CSV: {INPUT_CSV}")

    df = pd.read_csv(INPUT_CSV)

    # Basic completeness
    na_pct = (df.isna().mean() * 100).sort_values(ascending=False)
    dup_name = (
        df["name"].astype(str).str.strip().str.lower().duplicated().sum()
        if "name" in df.columns
        else 0
    )

    # Column-level parsing stats for array columns
    parse_stats: dict[str, ArrayParseStats] = {c: ArrayParseStats(column=c) for c in ARRAY_COLUMNS if c in df.columns}
    invalid_examples: dict[str, list[tuple[str, str]]] = {c: [] for c in parse_stats}

    cleaned = df.copy()

    # Trim known string fields
    if "name" in cleaned.columns:
        cleaned["name"] = cleaned["name"].astype(str).str.strip()

    for col, stats in parse_stats.items():
        new_values: list[str] = []
        for idx, raw in enumerate(df[col].tolist()):
            stats.total_rows += 1
            if _is_empty(raw):
                stats.empty_rows += 1
                new_values.append(_pg_array_literal([]))
                continue

            items, valid = _parse_json_array(raw)
            if valid:
                stats.valid_json_rows += 1
            else:
                stats.invalid_json_rows += 1
                if len(invalid_examples[col]) < 10:
                    ex_id = str(df.loc[idx, "id"]) if "id" in df.columns else str(idx)
                    ex_name = str(df.loc[idx, "name"]) if "name" in df.columns else ""
                    invalid_examples[col].append((f"{ex_id} {ex_name}".strip(), str(raw)[:200]))

            new_values.append(_pg_array_literal(items))

        cleaned[col] = new_values

    # Ensure booleans serialize in a Postgres-friendly way (lowercase)
    for bool_col in ["is_compound", "is_custom"]:
        if bool_col in cleaned.columns:
            cleaned[bool_col] = (
                cleaned[bool_col]
                .fillna(False)
                .map(lambda v: "true" if bool(v) else "false")
            )

    # Keep empty strings for nullable scalar columns so Supabase imports as NULL more reliably
    for nullable in ["description", "difficulty", "video_url", "image_url", "gif_url", "tips", "instructions", "exercisedb_id", "last_synced_at", "created_by"]:
        if nullable in cleaned.columns and nullable not in ARRAY_COLUMNS:
            cleaned[nullable] = cleaned[nullable].where(~cleaned[nullable].isna(), "")

    # Write cleaned CSV
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(OUTPUT_CSV, index=False, quoting=csv.QUOTE_MINIMAL)

    # Build markdown report
    lines: list[str] = []
    lines.append("# exercises_rows.csv audit\n")
    lines.append(f"Input: `{INPUT_CSV.relative_to(ROOT)}`")
    lines.append(f"Output (Supabase import): `{OUTPUT_CSV.relative_to(ROOT)}`\n")

    lines.append("## Summary\n")
    lines.append(f"- Rows: **{len(df)}**")
    lines.append(f"- Columns: **{df.shape[1]}**")
    lines.append(f"- Duplicate names (case/space-insensitive): **{int(dup_name)}**\n")

    lines.append("## Missingness (% empty/NULL)\n")
    lines.append("| column | missing % |\n|---|---:|")
    for col, pct in na_pct.items():
        lines.append(f"| {col} | {pct:.1f} |")

    if parse_stats:
        lines.append("\n## Array column import readiness (converted to Postgres text[] literals)\n")
        lines.append("| column | empty rows | valid JSON rows | invalid JSON rows |\n|---|---:|---:|---:|")
        for col, st in parse_stats.items():
            lines.append(f"| {col} | {st.empty_rows} | {st.valid_json_rows} | {st.invalid_json_rows} |")

        for col, examples in invalid_examples.items():
            if not examples:
                continue
            lines.append(f"\n### Invalid JSON examples: `{col}`\n")
            for ex_key, ex_val in examples:
                lines.append(f"- {ex_key}: `{ex_val}`")

    OUTPUT_REPORT_MD.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote {OUTPUT_CSV}")
    print(f"Wrote {OUTPUT_REPORT_MD}")


if __name__ == "__main__":
    main()
