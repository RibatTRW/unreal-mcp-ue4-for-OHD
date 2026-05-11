from typing import Dict, Optional
import json


def set_widget_position(
    widget_blueprint_path: str,
    widget_name: str,
    position: Dict[str, float],
    z_order: Optional[int] = None,
):
    try:
        widget_blueprint = load_widget_blueprint(widget_blueprint_path)
        widget_tree = get_widget_tree(widget_blueprint)

        widget = find_widget_in_tree(widget_tree, widget_name)
        if not widget:
            return {"error": "Widget not found: {0}".format(widget_name)}

        set_widget_canvas_position(widget, position, z_order)

        if not save_widget_blueprint(widget_blueprint):
            return {
                "error": "Widget position was updated but the widget blueprint could not be saved."
            }

        return {
            "success": True,
            "widget_blueprint_path": widget_blueprint_path,
            "widget_name": widget_name,
            "layout": get_widget_slot_layout(widget),
        }
    except Exception as exc:
        return {"error": "Failed to set widget position: {0}".format(str(exc))}


def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    widget_name = decode_template_json("""${widget_name}""")
    position = decode_template_json("""${position}""")
    z_order = decode_template_json("""${z_order}""")

    result = set_widget_position(
        widget_blueprint_path=widget_blueprint_path,
        widget_name=widget_name,
        position=position,
        z_order=z_order,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
