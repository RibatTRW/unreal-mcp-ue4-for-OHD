from typing import Dict, Optional
import json


def reparent_widget(
    widget_blueprint_path: str,
    widget_name: str,
    new_parent_widget_name: str,
    position: Optional[Dict[str, float]] = None,
    z_order: Optional[int] = None,
):
    try:
        widget_blueprint = load_widget_blueprint(widget_blueprint_path)
        widget_tree = get_widget_tree(widget_blueprint)

        widget = find_widget_in_tree(widget_tree, widget_name)
        if not widget:
            return {"error": "Widget not found: {0}".format(widget_name)}

        new_parent_widget = find_widget_in_tree(widget_tree, new_parent_widget_name)
        if not new_parent_widget:
            return {
                "error": "New parent widget not found: {0}".format(
                    new_parent_widget_name
                )
            }

        if widget == new_parent_widget:
            return {"error": "A widget cannot be parented to itself."}

        if get_root_widget(widget_tree) == widget:
            return {
                "error": "Reparenting the current root widget is not supported by this tool."
            }

        if widget_contains_descendant(widget, new_parent_widget):
            return {
                "error": "Cannot reparent a widget to one of its descendants."
            }

        require_panel_widget(new_parent_widget, new_parent_widget_name)

        old_parent_widget = widget.get_parent()
        if not old_parent_widget:
            old_parent_widget = find_widget_parent(widget_tree, widget)
        if not old_parent_widget:
            return {
                "error": "Widget does not have a removable parent: {0}".format(
                    widget_name
                )
            }

        old_layout = get_canvas_slot_layout(widget)

        if not old_parent_widget.remove_child(widget):
            return {
                "error": "Failed to detach widget from parent: {0}".format(
                    get_widget_name(old_parent_widget)
                )
            }

        try:
            add_widget_to_tree(widget_tree, widget, new_parent_widget)
        except Exception as exc:
            add_widget_to_tree(widget_tree, widget, old_parent_widget)
            if old_layout:
                set_widget_canvas_position(
                    widget,
                    old_layout["position"],
                    old_layout.get("z_order"),
                )
            raise exc

        if position is not None:
            set_widget_canvas_position(widget, position, z_order)
        elif old_layout is not None:
            try:
                set_widget_canvas_position(
                    widget,
                    old_layout["position"],
                    old_layout.get("z_order"),
                )
            except Exception:
                pass

        if not save_widget_blueprint(widget_blueprint):
            return {
                "error": "Widget was reparented but the widget blueprint could not be saved."
            }

        return {
            "success": True,
            "widget_blueprint_path": widget_blueprint_path,
            "widget_name": widget_name,
            "old_parent_widget_name": get_widget_name(old_parent_widget),
            "new_parent_widget_name": new_parent_widget_name,
            "layout": get_widget_slot_layout(widget),
        }
    except Exception as exc:
        return {"error": "Failed to reparent widget: {0}".format(str(exc))}


def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    widget_name = decode_template_json("""${widget_name}""")
    new_parent_widget_name = decode_template_json("""${new_parent_widget_name}""")
    position = decode_template_json("""${position}""")
    z_order = decode_template_json("""${z_order}""")

    result = reparent_widget(
        widget_blueprint_path=widget_blueprint_path,
        widget_name=widget_name,
        new_parent_widget_name=new_parent_widget_name,
        position=position,
        z_order=z_order,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
