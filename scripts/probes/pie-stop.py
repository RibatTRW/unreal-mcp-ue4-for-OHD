# Fire-and-forget PIE stop probe. Pair with pie-start.py.
# Python 2.7 safe (editor runs 2.7.14).
import json

try:
    stopper = getattr(unreal.EditorLevelLibrary, "editor_end_play", None)
    if not callable(stopper):
        print(json.dumps({
            "success": False,
            "message": "EditorLevelLibrary.editor_end_play is not exposed in this UE4.25 Python environment.",
        }))
    else:
        stopper()
        print(json.dumps({
            "success": True,
            "message": "PIE stop requested, returning without waiting.",
        }))
except Exception as exc:
    print(json.dumps({"success": False, "message": str(exc)}))
