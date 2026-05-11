def get_actor_summary(actor):
    actor_summary = {
        "name": actor.get_name(),
        "label": actor.get_actor_label(),
        "class": actor.get_class().get_name(),
        "location": {
            "x": actor.get_actor_location().x,
            "y": actor.get_actor_location().y,
            "z": actor.get_actor_location().z,
        },
        "rotation": {
            "pitch": actor.get_actor_rotation().pitch,
            "yaw": actor.get_actor_rotation().yaw,
            "roll": actor.get_actor_rotation().roll,
        },
        "scale": {
            "x": actor.get_actor_scale3d().x,
            "y": actor.get_actor_scale3d().y,
            "z": actor.get_actor_scale3d().z,
        },
        "hidden_in_editor": bool(actor.is_hidden_ed()),
    }

    try:
        actor_summary["folder_path"] = str(actor.get_folder_path())
    except Exception:
        actor_summary["folder_path"] = ""

    try:
        actor_summary["tags"] = [str(tag) for tag in list(actor.tags)]
    except Exception:
        actor_summary["tags"] = []

    component_summaries = []
    try:
        for component in list(actor.get_components_by_class(unreal.ActorComponent) or [])[:16]:
            component_summaries.append(
                {
                    "name": get_object_name(component),
                    "class": get_object_class_name(component),
                }
            )
    except Exception:
        pass

    actor_summary["components"] = component_summaries
    return actor_summary


def get_actor_property_report(actor):
    actor_report = get_actor_summary(actor)
    common_properties = {}

    for property_name in (
        "mobility",
        "actor_label",
        "can_be_damaged",
        "tick_group",
        "custom_time_dilation",
        "hidden",
        "b_hidden",
    ):
        property_value = get_editor_property_value(actor, property_name)
        if property_value is None:
            continue

        if isinstance(property_value, (str, int, float, bool)):
            common_properties[property_name] = property_value
        else:
            common_properties[property_name] = str(property_value)

    actor_report["properties"] = common_properties
    return actor_report


def set_canvas_panel_slot_layout(slot, position=None, size=None, z_order=None):
    if not slot:
        return

    if position is not None:
        slot.set_position(
            unreal.Vector2D(
                x=float(position[0] if isinstance(position, list) else position.get("x", 0.0)),
                y=float(position[1] if isinstance(position, list) else position.get("y", 0.0)),
            )
        )

    if size is not None and hasattr(slot, "set_size"):
        slot.set_size(
            unreal.Vector2D(
                x=float(size[0] if isinstance(size, list) else size.get("x", 0.0)),
                y=float(size[1] if isinstance(size, list) else size.get("y", 0.0)),
            )
        )

    if z_order is not None and hasattr(slot, "set_z_order"):
        slot.set_z_order(int(z_order))


def set_widget_text(widget, text_value):
    if widget is None:
        return False

    if hasattr(widget, "set_text"):
        try:
            widget.set_text(str(text_value))
            return True
        except Exception:
            pass

    return set_object_property(widget, "text", str(text_value))


def set_widget_font_size(widget, font_size):
    if widget is None or font_size is None:
        return False

    font_data = get_editor_property_value(widget, "font")
    if not font_data:
        return False

    try:
        if hasattr(font_data, "set_editor_property"):
            font_data.set_editor_property("size", int(font_size))
            widget.set_editor_property("font", font_data)
            return True
    except Exception:
        pass

    try:
        font_data.size = int(font_size)
        widget.set_editor_property("font", font_data)
        return True
    except Exception:
        return False


def as_vector3(values, default=None):
    values = values or default or [0.0, 0.0, 0.0]
    if isinstance(values, dict):
        return unreal.Vector(
            x=float(values.get("x", 0.0)),
            y=float(values.get("y", 0.0)),
            z=float(values.get("z", 0.0)),
        )

    return unreal.Vector(
        x=float(values[0]),
        y=float(values[1]),
        z=float(values[2]),
    )


def as_rotator(values, default=None):
    values = values or default or [0.0, 0.0, 0.0]
    if isinstance(values, dict):
        return unreal.Rotator(
            pitch=float(values.get("pitch", 0.0)),
            yaw=float(values.get("yaw", 0.0)),
            roll=float(values.get("roll", 0.0)),
        )

    return unreal.Rotator(
        pitch=float(values[0]),
        yaw=float(values[1]),
        roll=float(values[2]),
    )


def as_linear_color(values, default=None):
    values = values or default or [1.0, 1.0, 1.0, 1.0]
    if isinstance(values, dict):
        return unreal.LinearColor(
            r=float(values.get("r", 1.0)),
            g=float(values.get("g", 1.0)),
            b=float(values.get("b", 1.0)),
            a=float(values.get("a", 1.0)),
        )

    return unreal.LinearColor(
        r=float(values[0]),
        g=float(values[1]),
        b=float(values[2]),
        a=float(values[3] if len(values) > 3 else 1.0),
    )


def as_slate_color(values, default=None):
    linear_color = as_linear_color(values, default=default)
    try:
        return unreal.SlateColor(
            specified_color=linear_color,
            color_use_rule=unreal.SlateColorStylingMode.USE_COLOR_SPECIFIED,
        )
    except Exception:
        pass

    try:
        slate_color = unreal.SlateColor()
        set_object_property(slate_color, "specified_color", linear_color)
        set_object_property(
            slate_color,
            "color_use_rule",
            unreal.SlateColorStylingMode.USE_COLOR_SPECIFIED,
        )
        return slate_color
    except Exception:
        return None


def linear_color_to_record(color_value):
    if color_value is None:
        return None

    try:
        specified_color = get_editor_property_value(color_value, "specified_color")
        if specified_color is not None:
            color_value = specified_color
    except Exception:
        pass

    result = {}
    for source_name, target_name in (
        ("r", "r"),
        ("g", "g"),
        ("b", "b"),
        ("a", "a"),
        ("R", "r"),
        ("G", "g"),
        ("B", "b"),
        ("A", "a"),
    ):
        if target_name in result:
            continue
        try:
            result[target_name] = float(getattr(color_value, source_name))
        except Exception:
            pass

    return result if result else None


def apply_widget_color(widget, color_values, role="foreground"):
    if widget is None or color_values is None:
        return False

    color_value = as_linear_color(color_values)
    slate_color_value = as_slate_color(color_values)
    foreground_values = [value for value in (slate_color_value, color_value) if value is not None]
    background_values = [value for value in (color_value, slate_color_value) if value is not None]

    if role == "background":
        if _apply_widget_color_candidates(
            widget,
            background_values,
            ("set_background_color", "set_brush_color"),
            ("background_color", "brush_color"),
        ):
            return True

        return _apply_widget_color_candidates(
            widget,
            background_values,
            ("set_color_and_opacity", "set_foreground_color"),
            ("color_and_opacity",),
        )

    return _apply_widget_color_candidates(
        widget,
        foreground_values,
        ("set_color_and_opacity", "set_foreground_color"),
        ("color_and_opacity", "foreground_color"),
    )


def _apply_widget_color_candidates(widget, candidate_values, method_names, property_names):
    if not candidate_values:
        return False

    applied = False
    for method_name in method_names:
        method = getattr(widget, method_name, None)
        if callable(method):
            for candidate_value in candidate_values:
                try:
                    method(candidate_value)
                    applied = True
                    break
                except Exception:
                    continue

    for property_name in property_names:
        for candidate_value in candidate_values:
            if set_object_property(widget, property_name, candidate_value):
                applied = True
                break

    return applied


def get_widget_style_report(widget):
    style = {}

    font_data = get_editor_property_value(widget, "font")
    font_size = get_editor_property_value(font_data, "size") if font_data else None
    if font_size is not None:
        try:
            style["font_size"] = int(font_size)
        except Exception:
            style["font_size"] = font_size

    for property_name, output_name in (
        ("color_and_opacity", "color"),
        ("foreground_color", "foreground_color"),
        ("background_color", "background_color"),
        ("brush_color", "brush_color"),
        ("content_color_and_opacity", "content_color"),
    ):
        property_value = get_editor_property_value(widget, property_name)
        color_record = linear_color_to_record(property_value)
        if color_record:
            style[output_name] = color_record

    return style


def sanitize_asset_name(name, fallback="GeneratedAsset"):
    sanitized = re.sub(r"[^A-Za-z0-9_]+", "_", str(name or "")).strip("_")
    return sanitized or fallback
