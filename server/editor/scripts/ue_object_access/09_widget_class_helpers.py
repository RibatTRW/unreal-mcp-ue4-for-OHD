def get_widget_name(widget):
    try:
        return unreal_text(widget.get_name())
    except Exception:
        return ""


def get_widget_class_name(widget):
    try:
        return unreal_text(widget.get_class().get_name())
    except Exception:
        return ""


def get_UClass(class_reference):
    if class_reference is None:
        return None

    try:
        unreal_class_type = getattr(unreal, "Class", None)
        if unreal_class_type and isinstance(class_reference, unreal_class_type):
            return class_reference
    except Exception:
        pass

    try:
        if hasattr(class_reference, "static_class"):
            return class_reference.static_class()
    except Exception:
        pass

    return class_reference


def get_python_class_reference(class_reference):
    if not class_reference:
        return None

    try:
        if isinstance(class_reference, type):
            return class_reference
    except Exception:
        pass

    class_object = None
    unreal_class_type = getattr(unreal, "Class", None)

    try:
        if unreal_class_type and isinstance(class_reference, unreal_class_type):
            class_object = class_reference
    except Exception:
        pass

    if class_object is None:
        try:
            if hasattr(class_reference, "get_class"):
                class_object = class_reference.get_class()
        except Exception:
            class_object = None

    if class_object is None:
        try:
            if hasattr(class_reference, "static_class"):
                class_object = class_reference.static_class()
        except Exception:
            class_object = None

    class_name = get_object_name(class_object or class_reference)
    if not class_name:
        return None

    try:
        resolved_class = getattr(unreal, class_name, None)
        if isinstance(resolved_class, type):
            return resolved_class
    except Exception:
        pass

    return None


def get_super_UClass(class_reference):
    class_object = get_UClass(class_reference)
    if not class_object:
        return None

    for accessor_name in ("get_super_class", "get_super_struct"):
        accessor = getattr(class_object, accessor_name, None)
        if callable(accessor):
            try:
                super_class = accessor()
                if super_class:
                    return super_class
            except Exception:
                pass

    for property_name in ("super_class", "super_struct"):
        super_class = get_editor_property_value(class_object, property_name)
        if super_class:
            return super_class

    return None


def class_is_child_of(class_reference, parent_class_reference):
    if not class_reference or not parent_class_reference:
        return False

    if class_reference == parent_class_reference:
        return True

    try:
        if isinstance(class_reference, type) and isinstance(parent_class_reference, type):
            return issubclass(class_reference, parent_class_reference)
    except Exception:
        pass

    python_class = get_python_class_reference(class_reference)
    parent_python_class = get_python_class_reference(parent_class_reference)
    if python_class and parent_python_class:
        try:
            return issubclass(python_class, parent_python_class)
        except Exception:
            pass

    class_object = get_UClass(class_reference)
    parent_class_object = get_UClass(parent_class_reference)

    if not class_object or not parent_class_object:
        return False

    if class_object == parent_class_object:
        return True

    try:
        return bool(class_object.is_child_of(parent_class_object))
    except Exception:
        pass

    parent_name = get_object_name(parent_class_object)
    current_class = class_object
    visited_names = set()

    while current_class:
        current_name = get_object_name(current_class)
        if not current_name or current_name in visited_names:
            break

        if current_class == parent_class_object or current_name == parent_name:
            return True

        visited_names.add(current_name)
        current_class = get_super_UClass(current_class)

    return False


def object_is_instance_of(target_object, parent_class_reference):
    if not target_object or not parent_class_reference:
        return False

    parent_python_class = get_python_class_reference(parent_class_reference)
    if parent_python_class:
        try:
            return isinstance(target_object, parent_python_class)
        except Exception:
            pass

    try:
        return class_is_child_of(target_object.get_class(), parent_class_reference)
    except Exception:
        return False


def load_widget_blueprint(widget_blueprint_path):
    widget_blueprint = unreal.EditorAssetLibrary.load_asset(widget_blueprint_path)
    if not widget_blueprint:
        raise ValueError(
            "Widget blueprint not found: {0}".format(widget_blueprint_path)
        )

    widget_blueprint_class_name = ""
    try:
        widget_blueprint_class_name = widget_blueprint.get_class().get_name()
    except Exception:
        pass

    base_widget_blueprint_class = getattr(unreal, "BaseWidgetBlueprint", None)
    if base_widget_blueprint_class and isinstance(
        widget_blueprint, base_widget_blueprint_class
    ):
        return widget_blueprint

    if widget_blueprint_class_name.endswith("WidgetBlueprint"):
        return widget_blueprint

    raise ValueError(
        "Asset is not a widget blueprint: {0}".format(widget_blueprint_path)
    )
