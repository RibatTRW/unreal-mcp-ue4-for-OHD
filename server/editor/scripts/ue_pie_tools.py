import json
import time


def _get_pie_worlds():
    if not hasattr(unreal.EditorLevelLibrary, "get_pie_worlds"):
        return []

    try:
        return list(unreal.EditorLevelLibrary.get_pie_worlds(False))
    except TypeError:
        return list(unreal.EditorLevelLibrary.get_pie_worlds())
    except Exception:
        return []


def _get_game_world():
    if not hasattr(unreal.EditorLevelLibrary, "get_game_world"):
        return None

    try:
        return unreal.EditorLevelLibrary.get_game_world()
    except Exception:
        return None


def _pie_status(_args=None):
    pie_worlds = _get_pie_worlds()
    game_world = _get_game_world()

    return {
        "success": True,
        "is_pie_running": bool(game_world or pie_worlds),
        "game_world_name": game_world.get_name() if game_world else None,
        "pie_world_count": len(pie_worlds),
        "pie_worlds": [world.get_name() for world in pie_worlds],
    }


def start_pie(args):
    status = _pie_status()
    if status["is_pie_running"]:
        status["already_running"] = True
        return status

    starter = getattr(unreal.EditorLevelLibrary, "editor_play_simulate", None)
    if not callable(starter):
        return {
            "success": False,
            "message": "EditorLevelLibrary.editor_play_simulate is not exposed in this UE4.25 Python environment.",
        }

    try:
        starter()
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    # Fire-and-forget by design (run 8 diagnosis): the previous 10s
    # time.sleep poll ran on the game thread that PIE startup itself
    # needs to tick, which wedged the editor for 10+ minutes on a heavy
    # map. The harness observes readiness with separate is_pie_running
    # calls (pollPieStatus), so never block here.
    status = _pie_status()
    status["requested"] = True
    status["already_running"] = False
    status["transition_pending"] = not status["is_pie_running"]
    if status["transition_pending"]:
        status["message"] = (
            "PIE start was requested; poll is_pie_running until it reports "
            "a running session."
        )
    return status


def stop_pie(args):
    timeout_seconds = float(args.get("timeout_seconds", 8.0))
    poll_interval = float(args.get("poll_interval", 0.25))

    status = _pie_status()
    if not status["is_pie_running"]:
        status["already_stopped"] = True
        return status

    stopper = getattr(unreal.EditorLevelLibrary, "editor_end_play", None)
    if callable(stopper):
        try:
            stopper()
        except Exception as exc:
            return {"success": False, "message": str(exc)}
    else:
        # This 4.25 build exposes no editor_end_play: end the session
        # with a console quit against the live game world. The quit
        # lands asynchronously (observed delay up to ~60s); the caller
        # keeps polling. NEVER send quit/disconnect/exit with a None
        # world: engine teardown asserts InWorld and hard-crashes the
        # editor (run 17).
        game_world = _get_game_world()
        if game_world is None:
            return {
                "success": False,
                "message": (
                    "Cannot stop PIE: editor_end_play is not exposed and no "
                    "game world is available for a console quit. Stop the "
                    "session in the editor UI."
                ),
            }
        try:
            unreal.SystemLibrary.execute_console_command(game_world, "quit")
        except Exception as exc:
            return {"success": False, "message": str(exc)}

    deadline = time.time() + max(0.1, timeout_seconds)
    while time.time() <= deadline:
        status = _pie_status()
        if not status["is_pie_running"]:
            status["already_stopped"] = False
            status["requested"] = True
            status["transition_pending"] = False
            return status
        time.sleep(max(0.01, poll_interval))

    status = _pie_status()
    status["requested"] = True
    status["transition_pending"] = bool(status["is_pie_running"])
    if status["transition_pending"]:
        status["message"] = (
            "PIE stop was requested, but the editor needs an additional tick before "
            "get_pie_status reports that the session has stopped."
        )
    return status


OPERATIONS = {
    "get_pie_status": _pie_status,
    "start_pie": start_pie,
    "stop_pie": stop_pie,
}


def main():
    operation = decode_template_json("""${operation}""")
    args = decode_template_json("""${args}""")

    handler = OPERATIONS.get(operation)
    if not handler:
        print(
            json.dumps(
                {
                    "success": False,
                    "message": "Unknown PIE tool operation: {0}".format(operation),
                },
                indent=2,
            )
        )
        return

    try:
        result = handler(args or {})
    except Exception as exc:
        result = {"success": False, "message": str(exc)}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
