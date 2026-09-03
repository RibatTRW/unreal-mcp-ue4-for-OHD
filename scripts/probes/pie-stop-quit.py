# DO NOT RUN — sends execute_console_command(None, "quit"), which hard
# crashes the editor (Assertion failed: InWorld, run 17). Kept as the
# crash exhibit. Use pie-stop-quit2.py (world context) instead.
# Stop-PIE probe via console commands ("quit", then "disconnect").
# This build exposes editor_play_simulate but NO editor_end_play, so try
# the console back door: in a play/simulate session, "quit" should end
# the session and return to the editor. Reports every step as JSON.
# Python 2.7 safe (editor runs 2.7.14).
import json
import time


def _is_running():
    game_world = None
    if hasattr(unreal.EditorLevelLibrary, "get_game_world"):
        try:
            game_world = unreal.EditorLevelLibrary.get_game_world()
        except Exception:
            game_world = None
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
    return bool(game_world or pie_worlds)


report = {"success": True, "attempts": []}
try:
    report["was_running"] = _is_running()
    if not report["was_running"]:
        report["already_stopped"] = True
    else:
        for command in ("quit", "disconnect"):
            try:
                unreal.SystemLibrary.execute_console_command(None, command)
                report["attempts"].append(command + ":sent")
            except Exception as exc:
                report["attempts"].append(command + ":failed:" + str(exc))
                continue
            time.sleep(3.0)
            report["is_running_now"] = _is_running()
            if not report["is_running_now"]:
                report["stopped_by"] = command
                break
        if report.get("is_running_now", True):
            report["success"] = False
            report["message"] = "Session still running after quit+disconnect."
    print(json.dumps(report))
except Exception as exc:
    print(json.dumps({"success": False, "message": str(exc)}))
