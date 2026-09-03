def resolve_widget_class(widget_class):
    if not widget_class:
        return None

    try:
        if hasattr(unreal, widget_class):
            return getattr(unreal, widget_class)
    except Exception:
        pass

    try:
        resolved_class = unreal.load_class(None, widget_class)
        if resolved_class:
            return resolved_class
    except Exception:
        pass

    try:
        resolved_class = unreal.EditorAssetLibrary.load_blueprint_class(widget_class)
        if resolved_class:
            return resolved_class
    except Exception:
        pass

    return None


def create_widget_instance(widget_tree, widget_class, widget_name):
    resolved_class = resolve_widget_class(widget_class)
    if not resolved_class:
        raise ValueError("Could not find widget class: {0}".format(widget_class))

    if not class_is_child_of(resolved_class, unreal.Widget):
        raise ValueError("Class is not a UMG widget: {0}".format(widget_class))

    if class_is_child_of(resolved_class, unreal.UserWidget):
        raise ValueError(
            "UserWidget subclasses are not supported for nested widget creation in this UE4.25 tool. Use native widget classes such as CanvasPanel, Border, Button, TextBlock, or Image."
        )

    if find_widget_in_tree(widget_tree, widget_name):
        raise ValueError("Widget already exists: {0}".format(widget_name))

    constructor_error = None

    try:
        if hasattr(resolved_class, "static_class"):
            return resolved_class(widget_tree, widget_name)
    except Exception as exc:
        constructor_error = exc

    try:
        return new_object_compat(
            get_UClass(resolved_class), widget_tree, widget_name
        )
    except Exception as exc:
        if constructor_error:
            raise RuntimeError(
                "Failed to create widget '{0}': {1}; fallback failed: {2}".format(
                    widget_name, constructor_error, exc
                )
            )
        raise RuntimeError(
            "Failed to create widget '{0}': {1}".format(widget_name, exc)
        )
