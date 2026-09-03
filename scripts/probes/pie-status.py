# Minimal PIE-status probe. Returns immediately, never blocks.
# Pair with pie-start.py: start, wait a few seconds, status, repeat.
# Python 2.7 safe (editor runs 2.7.14).
import json

try:
    pie_worlds = []
    if hasattr(unreal.EditorLevelLibrary, "get_pie_worlds"):
        try:
            pie_worlds = list(unreal.EditorLevelLibrary.get_pie_worlds(False))
        except TypeError:
            pie_worlds = list(unreal.EditorLevelLibrary.get_pie_worlds())
        except Exception:
            pie_worlds = []

    game_world = None
    if hasattr(unreal.EditorLevelLibrary, "get_game_world"):
        try:
            game_world = unreal.EditorLevelLibrary.get_game_world()
        except Exception:
            game_world = None

    print(json.dumps({
        "success": True,
        "is_pie_running": bool(game_world or pie_worlds),
        "pie_world_count": len(pie_worlds),
    }))
except Exception as exc:
    print(json.dumps({"success": False, "message": str(exc)}))
