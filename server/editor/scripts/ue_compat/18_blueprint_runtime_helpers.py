def get_blueprint_parent_class(blueprint):
    return get_editor_property_value(blueprint, "parent_class")


def get_blueprint_generated_class(blueprint):
    generated_class = get_editor_property_value(blueprint, "generated_class")
    if generated_class:
        return generated_class

    try:
        generated_class_path = unreal_text(blueprint.generated_class())
        if generated_class_path:
            return unreal.load_class(None, generated_class_path)
    except Exception:
        pass

    asset_path = get_asset_package_name(blueprint)
    if asset_path:
        try:
            generated_class = unreal.EditorAssetLibrary.load_blueprint_class(asset_path)
            if generated_class:
                return generated_class
        except Exception:
            pass

        try:
            try_compile_blueprint(blueprint)
        except Exception:
            pass

        try:
            save_loaded_editor_asset(blueprint)
        except Exception:
            pass

        try:
            reloaded_blueprint = unreal.EditorAssetLibrary.load_asset(asset_path)
            if reloaded_blueprint:
                generated_class = get_editor_property_value(
                    reloaded_blueprint, "generated_class"
                )
                if generated_class:
                    return generated_class
        except Exception:
            pass

        try:
            generated_class = unreal.EditorAssetLibrary.load_blueprint_class(asset_path)
            if generated_class:
                return generated_class
        except Exception:
            pass

        try:
            asset_name = asset_path.rsplit("/", 1)[-1]
            generated_class = unreal.load_class(
                None,
                "{0}.{1}_C".format(asset_path, asset_name),
            )
            if generated_class:
                return generated_class
        except Exception:
            pass

    return None


def get_blueprint_default_object(blueprint):
    generated_class = get_blueprint_generated_class(blueprint)
    if not generated_class:
        return None

    try:
        get_default_object = getattr(unreal, "get_default_object", None)
        if callable(get_default_object):
            default_object = get_default_object(generated_class)
            if default_object:
                return default_object
    except Exception:
        pass

    try:
        return generated_class.get_default_object()
    except Exception:
        pass

    return None
