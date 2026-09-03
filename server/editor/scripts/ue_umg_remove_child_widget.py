import json


def remove_child_widget(
    widget_blueprint_path,
    parent_widget_name,
    child_widget_name,
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

        child_widget_class_name = get_widget_class_name(child_widget)

        if not remove_widget_from_blueprint_tree(widget_tree, child_widget):
            return {
                "error": "Failed to remove child widget: {0}".format(child_widget_name)
            }

        if not save_widget_blueprint(widget_blueprint):
            return {
                "error": "Child widget was removed but the widget blueprint could not be saved."
            }

        return {
            "success": True,
            "widget_blueprint_path": widget_blueprint_path,
            "parent_widget_name": parent_widget_name,
            "child_widget_name": child_widget_name,
            "class": child_widget_class_name,
        }
    except Exception as exc:
        return {"error": "Failed to remove child widget: {0}".format(unreal_text(exc))}


def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    parent_widget_name = decode_template_json("""${parent_widget_name}""")
    child_widget_name = decode_template_json("""${child_widget_name}""")

    result = remove_child_widget(
        widget_blueprint_path=widget_blueprint_path,
        parent_widget_name=parent_widget_name,
        child_widget_name=child_widget_name,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
