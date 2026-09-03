def add_component_template_to_blueprint(
    blueprint,
    component_class,
    component_name,
    location=None,
    rotation=None,
    scale=None,
    component_properties=None,
):
    generated_class = get_blueprint_generated_class(blueprint)
    if not generated_class:
        raise ValueError(
            "Blueprint generated class is not available for component template creation."
        )

    template_name = str(component_name or "").strip()
    if not template_name:
        raise ValueError("component_name is required")

    template_outer = get_blueprint_default_object(blueprint) or generated_class
    new_template = new_object_with_flags(
        component_class,
        template_outer,
        template_name,
        "PUBLIC",
        "ARCHETYPE_OBJECT",
        "TRANSACTIONAL",
    )
    if not new_template:
        raise RuntimeError(
            "Failed to create blueprint component template: {0}".format(component_name)
        )

    apply_scene_component_transform(new_template, location, rotation, scale)

    for property_name, property_value in (component_properties or {}).items():
        apply_component_property(new_template, property_name, property_value)

    component_templates = get_blueprint_component_templates(blueprint)
    if new_template not in component_templates:
        component_templates.append(new_template)
        set_object_property(blueprint, "component_templates", component_templates)

    return new_template


def add_component_node_to_blueprint(
    blueprint, component_class, component_name, parent_component_name=None
):
    if blueprint_supports_scs_editing(blueprint):
        scs = get_simple_construction_script(blueprint)
        create_node = getattr(scs, "create_node", None)
        add_node = getattr(scs, "add_node", None)

        new_node = create_node(get_UClass(component_class), component_name)
        if not new_node:
            raise RuntimeError(
                "Failed to create blueprint component node: {0}".format(component_name)
            )

        if parent_component_name:
            parent_node = find_scs_node(scs, parent_component_name)
            if not parent_node:
                raise ValueError(
                    "Parent component not found in blueprint: {0}".format(
                        parent_component_name
                    )
                )

            if not hasattr(parent_node, "add_child_node"):
                raise ValueError(
                    "Parent component cannot accept child nodes in this UE4.25 Python environment."
                )

            parent_node.add_child_node(new_node)
            return new_node

        root_nodes = get_scs_root_nodes(scs)
        default_root_node = get_default_scene_root_node(scs)

        if (
            root_nodes
            and not (len(root_nodes) == 1 and root_nodes[0] == default_root_node)
            and hasattr(root_nodes[0], "add_child_node")
            and class_is_child_of(component_class, unreal.SceneComponent)
        ):
            root_nodes[0].add_child_node(new_node)
        else:
            add_node(new_node)

        return new_node

    if parent_component_name:
        raise ValueError(
            "UE4.25 Python cannot parent Blueprint components without SimpleConstructionScript editing support."
        )

    return add_component_node_to_blueprint_via_graph_fallback(
        blueprint,
        component_class,
        component_name,
    )
