from typing import Dict, Optional
import json


def add_widget(
    widget_blueprint_path: str,
    widget_class: str,
    widget_name: str,
    parent_widget_name: Optional[str] = None,
    position: Optional[Dict[str, float]] = None,
    size: Optional[Dict[str, float]] = None,
    background_color=None,
    z_order: Optional[int] = None,
):
    widget_blueprint = None
    widget_tree = None
    new_widget = None
    try:
        widget_blueprint = load_widget_blueprint(widget_blueprint_path)
        widget_tree = get_widget_tree(widget_blueprint)

        parent_widget = None
        if parent_widget_name:
            parent_widget = find_widget_in_tree(widget_tree, parent_widget_name)
            if not parent_widget:
                return {
                    "error": "Parent widget not found: {0}".format(parent_widget_name)
                }

        new_widget = create_widget_instance(widget_tree, widget_class, widget_name)
        add_widget_to_tree(widget_tree, new_widget, parent_widget)
        apply_widget_color(new_widget, background_color, role="background")

        if position is not None or size is not None or z_order is not None:
            if z_order is None:
                z_order = default_z_order_for_widget(new_widget)
            set_widget_canvas_layout(new_widget, position=position, size=size, z_order=z_order)

        if not save_widget_blueprint(widget_blueprint):
            remove_widget_from_blueprint_tree(widget_tree, new_widget)
            save_widget_blueprint(widget_blueprint)
            return {
                "error": "Widget was added but the widget blueprint could not be saved; rolled back the new widget."
            }

        return {
            "success": True,
            "widget_blueprint_path": widget_blueprint_path,
            "widget_name": get_widget_name(new_widget),
            "class": get_widget_class_name(new_widget),
            "parent_widget_name": parent_widget_name,
            "is_root_widget": parent_widget is None,
            "layout": get_widget_slot_layout(new_widget),
            "style": get_widget_style_report(new_widget),
        }
    except Exception as exc:
        if widget_blueprint and widget_tree and new_widget:
            try:
                remove_widget_from_blueprint_tree(widget_tree, new_widget)
                save_widget_blueprint(widget_blueprint)
            except Exception:
                pass
        return {"error": "Failed to add widget: {0}".format(str(exc))}


def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    widget_class = decode_template_json("""${widget_class}""")
    widget_name = decode_template_json("""${widget_name}""")
    parent_widget_name = decode_template_json("""${parent_widget_name}""")
    position = decode_template_json("""${position}""")
    size = decode_template_json("""${size}""")
    background_color = decode_template_json("""${background_color}""")
    z_order = decode_template_json("""${z_order}""")

    result = add_widget(
        widget_blueprint_path=widget_blueprint_path,
        widget_class=widget_class,
        widget_name=widget_name,
        parent_widget_name=parent_widget_name,
        position=position,
        size=size,
        background_color=background_color,
        z_order=z_order,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
