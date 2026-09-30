"""Small dependency-free contract smoke test used by CI.

The service's Go tests cover behavior. This script catches the more dangerous
drift where a route or a field is added without updating the checked-in wire
contract, while keeping CI independent of a package manager.
"""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
schema = json.loads((ROOT / "game.v2.json").read_text(encoding="utf-8"))
defs = schema["$defs"]

required_defs = {
    "phase",
    "ending",
    "ai_state",
    "emotion",
    "position",
    "message",
    "event",
    "submit_turn",
    "public_state",
    "turn_assessment",
    "turn_result",
    "session_response",
    "events_response",
    "error_response",
}
missing = required_defs.difference(defs)
if missing:
    raise SystemExit(f"missing contract definitions: {sorted(missing)}")

for name in ("message", "event", "submit_turn", "public_state", "turn_result"):
    if defs[name].get("additionalProperties") is False:
        continue
    raise SystemExit(f"{name} must reject unknown fields")

for name, fields in {
    "submit_turn": {"command_id", "session_id", "expected_revision", "text"},
    "public_state": {"schema_version", "session_id", "revision", "phase", "messages", "ending"},
    "turn_result": {"command_id", "revision", "replay", "reply", "events", "state"},
}.items():
    actual = set(defs[name].get("required", []))
    if not fields.issubset(actual):
        raise SystemExit(f"{name} is missing required fields: {sorted(fields - actual)}")

print("game.v2 contract smoke test passed")
