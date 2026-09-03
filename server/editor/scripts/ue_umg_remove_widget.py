import json


def remove_widget(widget_blueprint_path, widget_name):
    try:
        widget_blueprint = load_widget_blueprint(widget_blueprint_path)
        widget_tree = get_widget_tree(widget_blueprint)

        widget = find_widget_in_tree(widget_tree, widget_name)
        if not widget:
            return {"error": "Widget not found: {0}".format(widget_name)}

        parent_widget = find_widget_parent(widget_tree, widget)
        was_root_widget = get_root_widget(widget_tree) == widget
        removed_class_name = get_widget_class_name(widget)

        if not remove_widget_from_blueprint_tree(widget_tree, widget):
            return {"error": "Failed to remove widget: {0}".format(widget_name)}

        if not save_widget_blueprint(widget_blueprint):
            return {
                "error": "Widget was removed but the widget blueprint could not be saved."
            }

        return {
            "success": True,
            "widget_blueprint_path": widget_blueprint_path,
            "widget_name": widget_name,
            "class": removed_class_name,
            "parent_widget_name": get_widget_name(parent_widget)
            if parent_widget
            else None,
            "was_root_widget": was_root_widget,
        }
    except Exception as exc:
        return {"error": "Failed to remove widget: {0}".format(str(exc))}


def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    widget_name = decode_template_json("""${widget_name}""")

    result = remove_widget(
        widget_blueprint_path=widget_blueprint_path,
        widget_name=widget_name,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
