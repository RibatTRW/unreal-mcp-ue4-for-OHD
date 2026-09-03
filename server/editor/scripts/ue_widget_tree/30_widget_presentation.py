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
            widget.set_text(unreal_text(text_value))
            return True
        except Exception:
            pass

    return set_object_property(widget, "text", unreal_text(text_value))


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

