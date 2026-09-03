# Faithful mirror of the e2e start_pie path in ue_pie_tools.py:
# request start, then SLEEP-POLL on the editor side for up to 10s.
# pie-start.py deliberately skips the poll; this file keeps it, so we can
# tell whether the in-editor sleep-poll itself wedges PIE startup.
# Python 2.7 safe (editor runs 2.7.14).
import json
import time


def _pie_status():
    pie_worlds = []
    if hasattr(unreal.EditorLevelLibrary, "get_pie_worlds"):
        try:
            pie_worlds = list(unreal.EditorLevelLibrary.get_pie_worlds(False))
        except TypeError:
            try:
                pie_worlds = list(unreal.EditorLevelLibrary.get_pie_worlds())
            except Exception:
                pie_worlds = []
        except Exception:
            pie_worlds = []

    game_world = None
    if hasattr(unreal.EditorLevelLibrary, "get_game_world"):
        try:
            game_world = unreal.EditorLevelLibrary.get_game_world()
        except Exception:
            game_world = None

    return {
        "success": True,
        "is_pie_running": bool(game_world or pie_worlds),
        "pie_world_count": len(pie_worlds),
    }


try:
    status = _pie_status()
    if status["is_pie_running"]:
        status["already_running"] = True
        print(json.dumps(status))
    else:
        starter = getattr(unreal.EditorLevelLibrary, "editor_play_simulate", None)
        if not callable(starter):
            print(json.dumps({
                "success": False,
                "message": "EditorLevelLibrary.editor_play_simulate is not exposed in this UE4.25 Python environment.",
            }))
        else:
            starter()
            deadline = time.time() + 10.0
            while time.time() <= deadline:
                status = _pie_status()
                if status["is_pie_running"]:
                    break
                time.sleep(0.25)
            status["requested"] = True
            status["transition_pending"] = not status["is_pie_running"]
            print(json.dumps(status))
except Exception as exc:
    print(json.dumps({"success": False, "message": str(exc)}))
