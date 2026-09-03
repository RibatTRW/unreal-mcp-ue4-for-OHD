import json


def reparent_widget(
    widget_blueprint_path,
    widget_name,
    new_parent_widget_name,
    position=None,
    size=None,
    z_order=None,
):
    widget_blueprint = None
    widget_tree = None
    widget = None
    old_parent_widget = None
    old_layout = None
    reparented = False

    def rollback_reparent():
        if not widget or not old_parent_widget:
            return False

        try:
            current_parent = widget.get_parent()
        except Exception:
            current_parent = None

        try:
            if current_parent:
                current_parent.remove_child(widget)
            else:
                widget.remove_from_parent()
        except Exception:
            pass

        try:
            add_widget_to_tree(widget_tree, widget, old_parent_widget)
            if old_layout:
                set_widget_canvas_layout(
                    widget,
                    position=old_layout["position"],
                    size=old_layout.get("size"),
                    z_order=old_layout.get("z_order"),
                )
            return True
        except Exception:
            return False

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
            reparented = True
        except Exception as exc:
            rollback_reparent()
            reparented = False
            raise exc

        try:
            if position is not None or size is not None or z_order is not None:
                set_widget_canvas_layout(widget, position=position, size=size, z_order=z_order)
            elif old_layout is not None:
                try:
                    set_widget_canvas_layout(
                        widget,
                        position=old_layout["position"],
                        size=old_layout.get("size"),
                        z_order=old_layout.get("z_order"),
                    )
                except Exception:
                    pass
        except Exception as exc:
            rollback_reparent()
            reparented = False
            raise exc

        if not save_widget_blueprint(widget_blueprint):
            rollback_reparent()
            reparented = False
            save_widget_blueprint(widget_blueprint)
            return {
                "error": "Widget was reparented but the widget blueprint could not be saved; rolled back the reparent."
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
        if reparented:
            rollback_reparent()
            try:
                save_widget_blueprint(widget_blueprint)
            except Exception:
                pass
        return {"error": "Failed to reparent widget: {0}".format(str(exc))}


def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    widget_name = decode_template_json("""${widget_name}""")
    new_parent_widget_name = decode_template_json("""${new_parent_widget_name}""")
    position = decode_template_json("""${position}""")
    size = decode_template_json("""${size}""")
    z_order = decode_template_json("""${z_order}""")

    result = reparent_widget(
        widget_blueprint_path=widget_blueprint_path,
        widget_name=widget_name,
        new_parent_widget_name=new_parent_widget_name,
        position=position,
        size=size,
        z_order=z_order,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
