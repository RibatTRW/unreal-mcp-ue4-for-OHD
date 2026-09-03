def _has_unreal_class(class_name):
    return hasattr(unreal, class_name)


def new_object_compat(object_class, outer, name=None):
    """Create a UObject without depending on the new_object factory.

    The OHD kit's Python has no such factory (probed live: hasattr is
    False); calling the UClass positionally performs the same
    NewObject(Outer, Class, Name) — probed working, while Outer=/Name=
    kwargs are rejected as invalid. On engines WITH the factory (4.27+),
    its known signatures are tried first so behavior there is unchanged.
    Returns the created object or None.
    """
    new_object = getattr(unreal, "new_object", None)
    if callable(new_object):
        if name is None:
            signature_attempts = [lambda: new_object(object_class, outer)]
        else:
            signature_attempts = [
                lambda: new_object(object_class, outer=outer, name=name),
                lambda: new_object(object_class, outer, name),
            ]
        for signature_attempt in signature_attempts:
            try:
                created_object = signature_attempt()
                if created_object:
                    return created_object
            except Exception:
                pass

    if name is None:
        try:
            return object_class(outer)
        except Exception:
            return None

    try:
        return object_class(outer, name)
    except Exception:
        pass

    try:
        return object_class(outer)
    except Exception:
        return None


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
