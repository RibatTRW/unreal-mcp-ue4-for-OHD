

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

dispatch_main("UMG tool")
