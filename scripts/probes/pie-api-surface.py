# Discover the real Play/Simulate/Stop API surface on this exact
# editor build. editor_play_simulate exists but editor_end_play does not,
# so ask the editor itself what it has.
# Python 2.7 safe (editor runs 2.7.14).
import json

try:
    keywords = ("play", "pie", "simul", "end", "quit", "stop")
    matches = [
        name for name in dir(unreal.EditorLevelLibrary)
        if any(key in name.lower() for key in keywords)
    ]
    print(json.dumps({"success": True, "matches": sorted(matches)}))
except Exception as exc:
    print(json.dumps({"success": False, "message": str(exc)}))
