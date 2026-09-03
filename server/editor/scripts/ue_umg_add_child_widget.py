import json


def add_child_widget(
    widget_blueprint_path,
    parent_widget_name,
    child_widget_class,
    child_widget_name,
    position=None,
    size=None,
    text=None,
    font_size=None,
    color=None,
    background_color=None,
    z_order=None,
):
    widget_blueprint = None
    widget_tree = None
    child_widget = None
    try:
        widget_blueprint = load_widget_blueprint(widget_blueprint_path)
        widget_tree = get_widget_tree(widget_blueprint)

        parent_widget = find_widget_in_tree(widget_tree, parent_widget_name)
        if not parent_widget:
            return {"error": "Parent widget not found: {0}".format(parent_widget_name)}

        child_widget = create_widget_instance(
            widget_tree, child_widget_class, child_widget_name
        )
        add_widget_to_tree(widget_tree, child_widget, parent_widget)
        apply_widget_color(child_widget, background_color, role="background")
        if text is not None:
            set_widget_text(child_widget, text)
        set_widget_font_size(child_widget, font_size)
        apply_widget_color(child_widget, color, role="foreground")

        if position is not None or size is not None or z_order is not None:
            if z_order is None:
                z_order = default_z_order_for_widget(child_widget)
            set_widget_canvas_layout(child_widget, position=position, size=size, z_order=z_order)

        if not save_widget_blueprint(widget_blueprint):
            remove_widget_from_blueprint_tree(widget_tree, child_widget)
            save_widget_blueprint(widget_blueprint)
            return {
                "error": "Child widget was added but the widget blueprint could not be saved; rolled back the new widget."
            }

        return {
            "success": True,
            "widget_blueprint_path": widget_blueprint_path,
            "parent_widget_name": parent_widget_name,
            "child_widget_name": get_widget_name(child_widget),
            "class": get_widget_class_name(child_widget),
            "text": str(text) if text is not None else None,
            "layout": get_widget_slot_layout(child_widget),
            "style": get_widget_style_report(child_widget),
        }
    except Exception as exc:
        if widget_blueprint and widget_tree and child_widget:
            try:
                remove_widget_from_blueprint_tree(widget_tree, child_widget)
                save_widget_blueprint(widget_blueprint)
            except Exception:
                pass
        return {"error": "Failed to add child widget: {0}".format(unreal_text(exc))}


def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    parent_widget_name = decode_template_json("""${parent_widget_name}""")
    child_widget_class = decode_template_json("""${child_widget_class}""")
    child_widget_name = decode_template_json("""${child_widget_name}""")
    position = decode_template_json("""${position}""")
    size = decode_template_json("""${size}""")
    text = decode_template_json("""${text}""")
    font_size = decode_template_json("""${font_size}""")
    color = decode_template_json("""${color}""")
    background_color = decode_template_json("""${background_color}""")
    z_order = decode_template_json("""${z_order}""")

    result = add_child_widget(
        widget_blueprint_path=widget_blueprint_path,
        parent_widget_name=parent_widget_name,
        child_widget_class=child_widget_class,
        child_widget_name=child_widget_name,
        position=position,
        size=size,
        text=text,
        font_size=font_size,
        color=color,
        background_color=background_color,
        z_order=z_order,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
