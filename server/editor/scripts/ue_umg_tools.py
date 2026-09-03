import json


OPERATIONS = {
    "create_umg_widget_blueprint": create_umg_widget_blueprint,
    "ensure_canvas_root": ensure_canvas_root_for_widget,
    "inspect_widget_tree": inspect_widget_tree,
    "add_text_block_to_widget": add_text_block_to_widget,
    "add_button_to_widget": add_button_to_widget,
    "bind_widget_event": bind_widget_event,
    "add_widget_to_viewport": add_widget_to_viewport,
    "set_text_block_binding": set_text_block_binding,
}


def main():
    operation = decode_template_json("""${operation}""")
    args = decode_template_json("""${args}""")

    handler = OPERATIONS.get(operation)
    if not handler:
        print(
            json.dumps(
                {
                    "success": False,
                    "message": "Unknown UMG tool operation: {0}".format(operation),
                },
                indent=2,
            )
        )
        return

    try:
        result = handler(args or {})
    except Exception as exc:
        result = {"success": False, "message": unreal_text(exc)}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
