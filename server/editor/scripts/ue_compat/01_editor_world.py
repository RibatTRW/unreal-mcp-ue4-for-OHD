def get_editor_world():
    try:
        if _has_unreal_class("UnrealEditorSubsystem"):
            subsystem = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
            if subsystem:
                world = subsystem.get_editor_world()
                if world:
                    return world
    except Exception:
        pass

    try:
        if hasattr(unreal, "EditorLevelLibrary") and hasattr(
            unreal.EditorLevelLibrary, "get_editor_world"
        ):
            return unreal.EditorLevelLibrary.get_editor_world()
    except Exception:
        pass

    return None


def get_all_level_actors():
    try:
        if _has_unreal_class("EditorActorSubsystem"):
            subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
            if subsystem:
                actors = subsystem.get_all_level_actors()
                if actors is not None:
                    return list(actors)
    except Exception:
        pass

    try:
        return list(unreal.EditorLevelLibrary.get_all_level_actors())
    except Exception:
        return []


def find_actor_by_name(actor_name):
    for actor in get_all_level_actors():
        try:
            if actor.get_name() == actor_name or actor.get_actor_label() == actor_name:
                return actor
        except Exception:
            continue
    return None


def destroy_actor(actor):
    try:
        if _has_unreal_class("EditorActorSubsystem"):
            subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
            if subsystem:
                return subsystem.destroy_actor(actor)
    except Exception:
        pass

    try:
        return unreal.EditorLevelLibrary.destroy_actor(actor)
    except Exception:
        return False


def get_streaming_level_names(world):
    streaming_levels = []

    try:
        streaming_levels = list(world.get_editor_property("streaming_levels"))
    except Exception:
        try:
            streaming_levels = list(world.streaming_levels)
        except Exception:
            streaming_levels = []

    names = []
    for streaming_level in streaming_levels:
        try:
            if hasattr(streaming_level, "get_world_asset_package_name"):
                name = unreal_text(streaming_level.get_world_asset_package_name())
                if name:
                    names.append(name)
                    continue
        except Exception:
            pass

        try:
            name = unreal_text(streaming_level.get_editor_property("package_name_to_load"))
            if name:
                names.append(name)
                continue
        except Exception:
            pass

        try:
            names.append(streaming_level.get_name())
        except Exception:
            continue

    return names


def take_editor_screenshot(width=640, height=520):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
        screenshot_path = temp_file.name

    try:
        if hasattr(unreal, "AutomationLibrary") and hasattr(
            unreal.AutomationLibrary, "take_high_res_screenshot"
        ):
            try:
                unreal.AutomationLibrary.take_high_res_screenshot(
                    width, height, screenshot_path
                )
                return screenshot_path
            except Exception:
                pass

        command = 'HighResShot {0}x{1} filename="{2}"'.format(
            width, height, screenshot_path
        )
        unreal.SystemLibrary.execute_console_command(None, command)
        return screenshot_path
    except Exception:
        try:
            os.unlink(screenshot_path)
        except Exception:
            pass
        return ""
