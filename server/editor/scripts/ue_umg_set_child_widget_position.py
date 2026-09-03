import json


def set_child_widget_position(
    widget_blueprint_path,
    parent_widget_name,
    child_widget_name,
    position=None,
    size=None,
    z_order=None,
):
    try:
        widget_blueprint = load_widget_blueprint(widget_blueprint_path)
        widget_tree = get_widget_tree(widget_blueprint)

        parent_widget = find_widget_in_tree(widget_tree, parent_widget_name)
        if not parent_widget:
            return {"error": "Parent widget not found: {0}".format(parent_widget_name)}

        child_widget = find_direct_child_widget(parent_widget, child_widget_name)
        if not child_widget:
            return {
                "error": "Direct child widget not found under '{0}': {1}".format(
                    parent_widget_name, child_widget_name
                )
            }

        set_widget_canvas_layout(child_widget, position=position, size=size, z_order=z_order)

        if not save_widget_blueprint(widget_blueprint):
            return {
                "error": "Child widget layout was updated but the widget blueprint could not be saved."
            }

        return {
            "success": True,
            "widget_blueprint_path": widget_blueprint_path,
            "parent_widget_name": parent_widget_name,
            "child_widget_name": child_widget_name,
            "layout": get_widget_slot_layout(child_widget),
        }
    except Exception as exc:
        return {
            "error": "Failed to set child widget position: {0}".format(str(exc))
        }


def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    parent_widget_name = decode_template_json("""${parent_widget_name}""")
    child_widget_name = decode_template_json("""${child_widget_name}""")
    position = decode_template_json("""${position}""")
    size = decode_template_json("""${size}""")
    z_order = decode_template_json("""${z_order}""")

    result = set_child_widget_position(
        widget_blueprint_path=widget_blueprint_path,
        parent_widget_name=parent_widget_name,
        child_widget_name=child_widget_name,
        position=position,
        size=size,
        z_order=z_order,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
