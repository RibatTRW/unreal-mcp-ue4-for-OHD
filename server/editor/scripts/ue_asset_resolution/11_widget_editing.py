def add_widget_to_tree(widget_tree, widget, parent_widget=None):
    if parent_widget is None:
        if get_root_widget(widget_tree):
            raise ValueError(
                "Widget blueprint already has a root widget. Use manage_widget.add_child_widget for nested widgets, or pass parent_widget_name when calling add_widget."
            )
        if not set_object_property(widget_tree, "root_widget", widget):
            raise RuntimeError("Failed to assign root widget")
        return None

    parent_widget = require_panel_widget(parent_widget)

    slot = None
    try:
        if object_is_instance_of(parent_widget, unreal.CanvasPanel) and hasattr(
            parent_widget, "add_child_to_canvas"
        ):
            slot = parent_widget.add_child_to_canvas(widget)
        else:
            slot = parent_widget.add_child(widget)
    except Exception as exc:
        raise RuntimeError(
            "Failed to add widget '{0}' to parent '{1}': {2}".format(
                get_widget_name(widget), get_widget_name(parent_widget), exc
            )
        )

    if slot is None:
        raise RuntimeError(
            "Parent widget '{0}' could not accept child widget '{1}'.".format(
                get_widget_name(parent_widget), get_widget_name(widget)
            )
        )

    return slot


def make_unique_widget_name(widget_tree, base_name):
    normalized_name = unreal_text(base_name or "RootCanvas").strip() or "RootCanvas"
    if not find_widget_in_tree(widget_tree, normalized_name):
        return normalized_name

    index = 1
    while index < 1000:
        candidate_name = "{0}_{1}".format(normalized_name, index)
        if not find_widget_in_tree(widget_tree, candidate_name):
            return candidate_name
        index += 1

    raise ValueError("Could not find a unique widget name for: {0}".format(normalized_name))


def rename_widget_in_tree(widget_tree, widget, requested_name):
    normalized_name = unreal_text(requested_name or "").strip()
    if not widget or not normalized_name:
        return False

    if get_widget_name(widget) == normalized_name:
        return False

    target_name = make_unique_widget_name(widget_tree, normalized_name)
    try:
        widget.rename(target_name, widget_tree)
        touch_editor_object(widget_tree)
        touch_editor_object(widget)
        return True
    except Exception:
        return False


def default_z_order_for_widget(widget):
    class_name = get_widget_class_name(widget).lower()
    if any(token in class_name for token in ("button", "text", "checkbox", "slider")):
        return 1
    return 0


def set_canvas_panel_slot_fill(slot):
    if not slot or not object_is_instance_of(slot, unreal.CanvasPanelSlot):
        return False

    changed = False

    try:
        if hasattr(slot, "set_anchors") and hasattr(unreal, "Anchors"):
            anchors = unreal.Anchors()
            set_object_property(anchors, "minimum", unreal.Vector2D(x=0.0, y=0.0))
            set_object_property(anchors, "maximum", unreal.Vector2D(x=1.0, y=1.0))
            slot.set_anchors(anchors)
            changed = True
    except Exception:
        pass

    try:
        if hasattr(slot, "set_offsets") and hasattr(unreal, "Margin"):
            offsets = unreal.Margin()
            set_object_property(offsets, "left", 0.0)
            set_object_property(offsets, "top", 0.0)
            set_object_property(offsets, "right", 0.0)
            set_object_property(offsets, "bottom", 0.0)
            slot.set_offsets(offsets)
            changed = True
    except Exception:
        pass

    try:
        if hasattr(slot, "set_alignment"):
            slot.set_alignment(unreal.Vector2D(x=0.0, y=0.0))
            changed = True
    except Exception:
        pass

    try:
        if hasattr(slot, "set_auto_size"):
            slot.set_auto_size(False)
            changed = True
    except Exception:
        pass

    return changed


def ensure_canvas_root(widget_blueprint, root_widget_name=None, wrap_existing_root=True):
    widget_tree = get_widget_tree(widget_blueprint)
    property_root = get_editor_property_value(widget_tree, "root_widget")
    current_root = get_root_widget(widget_tree)

    if current_root and object_is_instance_of(current_root, unreal.CanvasPanel):
        renamed = rename_widget_in_tree(widget_tree, current_root, root_widget_name)
        if not property_root:
            set_object_property(widget_tree, "root_widget", current_root)
            touch_editor_object(widget_tree)
            touch_editor_object(current_root)
        return {
            "widget_tree": widget_tree,
            "root_widget": current_root,
            "previous_root_widget": None,
            "created": False,
            "wrapped_existing_root": False,
            "renamed_existing_root": renamed,
            "slot": None,
        }

    if current_root and not wrap_existing_root:
        raise ValueError(
            "Widget root '{0}' is not a CanvasPanel. Pass wrap_existing_root=true to wrap it in a new CanvasPanel root.".format(
                get_widget_name(current_root)
            )
        )

    canvas_name = make_unique_widget_name(widget_tree, root_widget_name or "RootCanvas")
    canvas_root = create_widget_instance(widget_tree, "CanvasPanel", canvas_name)

    if not set_object_property(widget_tree, "root_widget", canvas_root):
        raise RuntimeError("Failed to assign CanvasPanel as widget root")

    slot = None
    if current_root:
        try:
            slot = add_widget_to_tree(widget_tree, current_root, canvas_root)
            set_canvas_panel_slot_fill(slot)
        except Exception:
            set_object_property(widget_tree, "root_widget", current_root)
            raise

    touch_editor_object(widget_tree)
    touch_editor_object(canvas_root)
    touch_editor_object(current_root)

    return {
        "widget_tree": widget_tree,
        "root_widget": canvas_root,
        "previous_root_widget": current_root,
        "created": current_root is None,
        "wrapped_existing_root": current_root is not None,
        "renamed_existing_root": False,
        "slot": slot,
    }


def get_canvas_panel_slot(widget):
    slot = get_editor_property_value(widget, "slot")
    if not slot:
        return None

    try:
        if object_is_instance_of(slot, unreal.CanvasPanelSlot):
            return slot
    except Exception:
        pass

    return None


def set_widget_canvas_layout(widget, position=None, size=None, z_order=None):
    slot = get_canvas_panel_slot(widget)
    if not slot:
        raise ValueError(
            "Widget '{0}' is not attached to a CanvasPanel slot. Layout changes are only supported for CanvasPanel children in UE4.25.".format(
                get_widget_name(widget)
            )
        )

    set_canvas_panel_slot_layout(slot, position=position, size=size, z_order=z_order)

    return slot


def set_widget_canvas_position(widget, position, z_order=None):
    return set_widget_canvas_layout(widget, position=position, z_order=z_order)


def get_canvas_slot_layout(widget):
    slot = get_canvas_panel_slot(widget)
    if not slot:
        return None

    position = slot.get_position()
    size = slot.get_size()

    return {
        "position": {"x": position.x, "y": position.y},
        "size": {"x": size.x, "y": size.y},
        "z_order": slot.get_z_order(),
    }


def get_widget_slot_layout(widget):
    slot = get_editor_property_value(widget, "slot")
    if not slot:
        return None

    layout = {
        "slot_class": get_object_class_name(slot),
        "supports_canvas_position": False,
    }

    canvas_layout = get_canvas_slot_layout(widget)
    if canvas_layout:
        layout.update(canvas_layout)
        layout["supports_canvas_position"] = True

    return layout


def remove_widget_from_blueprint_tree(widget_tree, widget):
    if not widget_tree or not widget:
        return False

    root_widget = get_root_widget(widget_tree)
    subtree = get_widget_subtree(widget)

    if root_widget == widget:
        if not set_object_property(widget_tree, "root_widget", None):
            return False
    else:
        try:
            widget.remove_from_parent()
        except Exception:
            return False

    transient_package_getter = getattr(unreal, "get_transient_package", None)
    transient_package = None
    if callable(transient_package_getter):
        try:
            transient_package = transient_package_getter()
        except Exception:
            transient_package = None

    if transient_package is None:
        try:
            transient_package = unreal.find_object(None, "/Engine/Transient")
        except Exception:
            transient_package = None

    for subtree_widget in subtree:
        try:
            if transient_package is not None:
                subtree_widget.rename(None, transient_package)
            else:
                subtree_widget.rename(None, widget_tree)
        except Exception:
            continue

    return True


def save_widget_blueprint(widget_blueprint):
    touch_editor_object(widget_blueprint)

    try:
        widget_tree = get_widget_tree(widget_blueprint)
        touch_editor_object(widget_tree)
        touch_editor_object(get_root_widget(widget_tree))
    except Exception:
        pass

    try:
        widget_blueprint.post_edit_change()
    except Exception:
        pass

    try_compile_blueprint(widget_blueprint)

    try:
        result = unreal.EditorAssetLibrary.save_loaded_asset(widget_blueprint)
        if result is None:
            return True
        return bool(result)
    except TypeError:
        try:
            result = unreal.EditorAssetLibrary.save_loaded_asset(widget_blueprint, False)
            if result is None:
                return True
            return bool(result)
        except Exception:
            pass
    except Exception:
        pass

    asset_path = get_asset_package_name(widget_blueprint)
    if asset_path:
        try:
            result = unreal.EditorAssetLibrary.save_asset(asset_path, False)
            if result is None:
                return True
            return bool(result)
        except Exception:
            pass

    return False
