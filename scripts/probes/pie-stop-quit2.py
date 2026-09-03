# Stop-PIE probe, second attempt: pass the GAME WORLD as the console
# command context instead of None.
#
# pie-stop-quit.py sent execute_console_command(None, "quit") and hard
# crashed the editor (Assertion failed: InWorld — engine teardown code
# requires a world, None violates it). This variant passes the live game
# world object and REFUSES to send a bare-context quit.
# Python 2.7 safe (editor runs 2.7.14).
import json
import time


def _status():
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

    return (bool(game_world or pie_worlds), game_world)


report = {"success": True, "attempts": []}
try:
    running, game_world = _status()
    report["was_running"] = running
    if not running:
        report["already_stopped"] = True
    elif game_world is None:
        report["success"] = False
        report["message"] = (
            "Session flag set but no game world object; refusing "
            "bare-context quit (known InWorld crash)."
        )
    else:
        try:
            unreal.SystemLibrary.execute_console_command(game_world, "quit")
            report["attempts"].append("quit_with_world:sent")
        except Exception as exc:
            report["attempts"].append("quit_with_world:failed:" + str(exc))
        else:
            time.sleep(3.0)
            running, _game_world = _status()
            report["is_running_now"] = running
            if not running:
                report["stopped_by"] = "quit_with_world"
            else:
                report["success"] = False
                report["message"] = "Session still running after world-context quit."
    print(json.dumps(report))
except Exception as exc:
    print(json.dumps({"success": False, "message": str(exc)}))
