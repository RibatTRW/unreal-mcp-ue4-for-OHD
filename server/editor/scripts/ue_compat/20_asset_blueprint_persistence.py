def get_object_flags_value(*flag_names):
    object_flags = getattr(unreal, "ObjectFlags", None)
    if not object_flags:
        return None

    resolved_value = None
    for flag_name in flag_names:
        try:
            flag_value = getattr(object_flags, flag_name)
        except Exception:
            continue

        resolved_value = flag_value if resolved_value is None else (resolved_value | flag_value)

    return resolved_value


def new_object_with_flags(object_class, outer, name, *flag_names):
    object_flags = get_object_flags_value(*flag_names)

    constructor_attempts = []
    if object_flags is not None and callable(getattr(unreal, "new_object", None)):
        constructor_attempts.extend(
            [
                lambda: unreal.new_object(
                    object_class,
                    outer=outer,
                    name=name,
                    set_flags=object_flags,
                ),
                lambda: unreal.new_object(object_class, outer, name, set_flags=object_flags),
                lambda: unreal.new_object(object_class, outer, name, object_flags),
            ]
        )

    # Positional class-call covers engines without unreal.new_object
    # (OHD kit, probed live) as well as the plain no-flags case.
    constructor_attempts.append(
        lambda: new_object_compat(object_class, outer, name)
    )

    last_error = None
    for constructor in constructor_attempts:
        try:
            created_object = constructor()
            if created_object and object_flags is not None and hasattr(created_object, "set_flags"):
                try:
                    created_object.set_flags(object_flags)
                except Exception:
                    pass
            if created_object:
                return created_object
        except Exception as exc:
            last_error = exc

    if last_error:
        raise last_error

    return None


def save_loaded_editor_asset(asset):
    touch_editor_object(asset)

    try:
        asset.post_edit_change()
    except Exception:
        pass

    try:
        result = unreal.EditorAssetLibrary.save_loaded_asset(asset)
        if result is None:
            return True
        return bool(result)
    except TypeError:
        try:
            result = unreal.EditorAssetLibrary.save_loaded_asset(asset, False)
            if result is None:
                return True
            return bool(result)
        except Exception:
            pass
    except Exception:
        pass

    asset_path = get_asset_package_name(asset)
    if asset_path:
        try:
            result = unreal.EditorAssetLibrary.save_asset(asset_path, False)
            if result is None:
                return True
            return bool(result)
        except Exception:
            pass

    return False


def finalize_blueprint_change(blueprint, structural=False):
    cdo = get_blueprint_default_object(blueprint)
    if cdo:
        touch_editor_object(cdo)

    touch_editor_object(blueprint)

    if structural:
        for utility_name in ("BlueprintEditorUtils", "KismetEditorUtilities"):
            utility_class = getattr(unreal, utility_name, None)
            if utility_class and hasattr(
                utility_class, "mark_blueprint_as_structurally_modified"
            ):
                try:
                    utility_class.mark_blueprint_as_structurally_modified(blueprint)
                    break
                except Exception:
                    continue

    try:
        blueprint.post_edit_change()
    except Exception:
        pass

    try_compile_blueprint(blueprint)
    return save_loaded_editor_asset(blueprint)
