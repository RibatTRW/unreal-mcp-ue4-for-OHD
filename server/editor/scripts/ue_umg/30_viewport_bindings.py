import time


def bind_widget_event(args):
    widget_name = args.get("widget_name")
    widget_member_name = args.get("widget_member_name") or args.get("widget_component_name")
    event_name = args.get("event_name")
    function_name = args.get("function_name") or "{0}_{1}".format(
        widget_member_name, event_name
    )

    if not widget_member_name:
        return {"success": False, "message": "widget_member_name is required"}

    try:
        widget_blueprint = _load_widget_blueprint(widget_name)
        _apply_delegate_binding(
            widget_blueprint,
            widget_member_name,
            event_name,
            function_name=function_name,
        )
        return {
            "success": True,
            "widget_blueprint": get_asset_package_name(widget_blueprint),
            "widget": widget_member_name,
            "event_name": event_name,
            "function_name": function_name,
        }
    except Exception as exc:
        return _format_widget_authoring_error(exc)


def add_widget_to_viewport(args):
    widget_name = args.get("widget_name")
    z_order = int(args.get("z_order", 0))
    start_pie_if_needed = bool(
        args.get("start_pie_if_needed") or args.get("auto_start_pie")
    )
    timeout_seconds = float(args.get("timeout_seconds", 8.0))
    poll_interval = float(args.get("poll_interval", 0.25))

    widget_blueprint, widget_path, widget_class = _resolve_widget_runtime_class(widget_name)
    if not widget_blueprint and not widget_class:
        return {
            "success": False,
            "message": "Asset not found: {0}".format(widget_name),
        }

    if not widget_class and widget_blueprint:
        widget_class = get_blueprint_generated_class(widget_blueprint)

    if not widget_class:
        return {
            "success": False,
            "message": "Could not resolve widget class for {0}".format(widget_name),
        }

    pie_status = None
    game_world = _get_viewport_game_world()
    if not game_world and start_pie_if_needed:
        pie_status = _start_pie_for_viewport(timeout_seconds, poll_interval)
        if pie_status.get("success") is False:
            return pie_status
        game_world = _get_viewport_game_world()

    if not game_world:
        if pie_status:
            return {
                "success": False,
                "message": "PIE start was requested, but the game world is not ready yet. Retry manage_widget.add_to_viewport after the editor advances a tick.",
                "transition_pending": True,
                "retry_recommended": True,
                "retry_action": "add_to_viewport",
                "pie_status": pie_status,
            }

        return {
            "success": False,
            "message": "A PIE or game world is required to add a widget to the viewport. Pass start_pie_if_needed: true to let this action start PIE first.",
        }

    widget_instance = None
    try:
        if hasattr(unreal.UserWidget, "create_widget_instance"):
            widget_instance = unreal.UserWidget.create_widget_instance(
                game_world,
                widget_class,
                widget_class.get_name(),
            )
    except Exception:
        widget_instance = None

    if widget_instance is None:
        try:
            widget_instance = new_object_compat(get_UClass(widget_class), game_world)
        except Exception:
            widget_instance = None

    if widget_instance is None or not hasattr(widget_instance, "add_to_viewport"):
        return {
            "success": False,
            "message": "Could not instantiate a UserWidget in this UE4.25 Python environment.",
            "unsupported_capability": "widget_viewport_instantiation",
        }

    try:
        widget_instance.add_to_viewport(z_order)
    except Exception as exc:
        return _format_widget_authoring_error(exc)

    return {
        "success": True,
        "widget_blueprint": widget_path,
        "widget_class": get_object_name(widget_class),
        "z_order": z_order,
        "started_pie": bool(pie_status and pie_status.get("requested")),
        "pie_status": pie_status,
    }


def _get_viewport_game_world():
    try:
        if hasattr(unreal.EditorLevelLibrary, "get_game_world"):
            return unreal.EditorLevelLibrary.get_game_world()
    except Exception:
        return None
    return None


def _get_viewport_pie_worlds():
    if not hasattr(unreal.EditorLevelLibrary, "get_pie_worlds"):
        return []

    try:
        return list(unreal.EditorLevelLibrary.get_pie_worlds(False))
    except TypeError:
        return list(unreal.EditorLevelLibrary.get_pie_worlds())
    except Exception:
        return []


def _get_viewport_pie_status():
    game_world = _get_viewport_game_world()
    pie_worlds = _get_viewport_pie_worlds()
    return {
        "success": True,
        "is_pie_running": bool(game_world or pie_worlds),
        "game_world_name": game_world.get_name() if game_world else None,
        "pie_world_count": len(pie_worlds),
        "pie_worlds": [world.get_name() for world in pie_worlds],
    }


def _start_pie_for_viewport(timeout_seconds, poll_interval):
    status = _get_viewport_pie_status()
    if status.get("game_world_name"):
        status["already_running"] = True
        return status

    if status["is_pie_running"]:
        status["requested"] = False
        status["transition_pending"] = True
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
        return {"success": False, "message": unreal_text(exc)}

    # Fire-and-forget (run 8/21 diagnosis): never sleep-poll the game
    # thread here. The caller answers retry_recommended until a later
    # is_pie_running poll observes the game world.
    status = _get_viewport_pie_status()
    status["requested"] = True
    status["transition_pending"] = not status.get("game_world_name")
    if status["transition_pending"]:
        status["message"] = "PIE start was requested, but no game world is available yet."
    return status


def set_text_block_binding(args):
    widget_name = args.get("widget_name")
    text_block_name = args.get("text_block_name")
    binding_property = args.get("binding_property") or "TextDelegate"
    function_name = args.get("function_name")
    source_property = args.get("source_property")

    if not function_name and not source_property:
        return {
            "success": False,
            "message": "Either function_name or source_property is required.",
        }

    try:
        widget_blueprint = _load_widget_blueprint(widget_name)
        _apply_delegate_binding(
            widget_blueprint,
            text_block_name,
            binding_property,
            function_name=function_name,
            source_property=source_property,
        )
        return {
            "success": True,
            "widget_blueprint": get_asset_package_name(widget_blueprint),
            "widget": text_block_name,
            "binding_property": binding_property,
            "function_name": function_name,
            "source_property": source_property,
        }
    except Exception as exc:
        return _format_widget_authoring_error(exc)
