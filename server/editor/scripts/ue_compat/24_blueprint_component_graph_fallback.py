def add_component_node_to_blueprint_via_graph_fallback(
    blueprint,
    component_class,
    component_name,
):
    construction_graph = get_blueprint_construction_graph(blueprint)
    if not construction_graph:
        raise ValueError(
            "Blueprint does not expose a UserConstructionScript graph in this UE4.25 Python environment."
        )

    generated_class = get_blueprint_generated_class(blueprint)
    if not generated_class:
        raise ValueError(
            "Blueprint generated class is not available for component template creation."
        )

    template_name = unreal_text(component_name).strip()
    if not template_name:
        raise ValueError("component_name is required")

    new_template = new_object_compat(component_class, generated_class, template_name)
    if not new_template:
        raise RuntimeError(
            "Failed to create blueprint component template: {0}".format(component_name)
        )

    component_templates = get_blueprint_component_templates(blueprint)
    component_templates.append(new_template)
    set_object_property(blueprint, "component_templates", component_templates)

    node = create_graph_node(
        construction_graph,
        "/Script/BlueprintGraph.K2Node_AddComponent",
        [0, len(get_graph_nodes(construction_graph)) * 180],
    )

    function_reference = get_editor_property_value(node, "function_reference")
    try_set_member_reference(
        function_reference,
        "AddComponent",
        parent_class=unreal.Actor,
        self_context=True,
    )
    set_object_property(node, "function_reference", function_reference)
    set_object_property(node, "template_type", get_UClass(component_class))
    reconstruct_graph_node(node)

    template_name_pin = find_node_pin(node, "TemplateName")
    if template_name_pin:
        set_pin_default(template_name_pin, get_object_name(new_template))

    entry_node = None
    for graph_node in get_graph_nodes(construction_graph):
        if get_object_class_name(graph_node) == "K2Node_FunctionEntry":
            entry_node = graph_node
            break

    if entry_node:
        entry_pin = find_node_pin(entry_node, "then") or find_node_pin(entry_node, "Then")
        execute_pin = find_node_pin(node, "execute") or find_node_pin(node, "Execute")
        if entry_pin and execute_pin and not list(getattr(entry_pin, "linked_to", []) or []):
            try:
                entry_pin.make_link_to(execute_pin)
            except Exception:
                pass

    return node
