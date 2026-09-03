# Minimal PIE-start probe (fire-and-forget, no sleep-poll).
#
# The full e2e start_pie path blocks the remote-execution channel with a
# ~10s sleep-poll on the editor side. This probe only REQUESTS the start and
# returns immediately, so a slow/hung PIE shows up as "answered but pending"
# instead of a 20s harness timeout. Pair with pie-status.py.
# Python 2.7 safe (editor runs 2.7.14).
import json

try:
    starter = getattr(unreal.EditorLevelLibrary, "editor_play_simulate", None)
    if not callable(starter):
        print(json.dumps({
            "success": False,
            "message": "EditorLevelLibrary.editor_play_simulate is not exposed in this UE4.25 Python environment.",
        }))
    else:
        starter()
        print(json.dumps({
            "success": True,
            "message": "PIE start requested, returning without waiting. Run pie-status.py after a few seconds.",
        }))
except Exception as exc:
    print(json.dumps({"success": False, "message": str(exc)}))
