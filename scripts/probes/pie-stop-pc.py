# Stop-PIE probe, third attempt: go through the PLAYER CONTROLLER.
# Global console "quit" (even with a world) is ignored by Simulate
# sessions, so try the player path instead: KismetSystemLibrary.quit_game
# and APlayerController.console_command, which route through different
# engine code than SystemLibrary.execute_console_command.
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
    else:
        player = None
        try:
            player = unreal.GameplayStatics.get_player_controller(game_world, 0)
        except Exception as exc:
            report["attempts"].append("get_player_controller:failed:" + str(exc))
        if player is None:
            report["attempts"].append("get_player_controller:none")
            report["success"] = False
            report["message"] = "No player controller: player-path stop impossible."
        else:
            report["attempts"].append("get_player_controller:found")
            try:
                unreal.KismetSystemLibrary.quit_game(game_world, player, 0, False)
                report["attempts"].append("quit_game:sent")
            except Exception as exc:
                report["attempts"].append("quit_game:failed:" + str(exc))
            else:
                time.sleep(3.0)
                running, _game_world = _status()
                report["is_running_now"] = running
                if not running:
                    report["stopped_by"] = "quit_game"
                else:
                    try:
                        player.console_command("quit")
                        report["attempts"].append("pc_console_quit:sent")
                    except Exception as exc:
                        report["attempts"].append("pc_console_quit:failed:" + str(exc))
                    else:
                        time.sleep(3.0)
                        running, _game_world = _status()
                        report["is_running_now"] = running
                        if not running:
                            report["stopped_by"] = "pc_console_quit"
                        else:
                            report["success"] = False
                            report["message"] = "Session still running after player-path stops."
    print(json.dumps(report))
except Exception as exc:
    print(json.dumps({"success": False, "message": str(exc)}))
