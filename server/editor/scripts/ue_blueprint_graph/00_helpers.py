def _load_blueprint_and_graph(blueprint_name, graph_name=None):
    blueprint = load_blueprint_asset(blueprint_name)
    if graph_name:
        for graph in get_blueprint_graphs(blueprint):
            if get_object_name(graph) == graph_name:
                return blueprint, graph
        raise ValueError("Blueprint graph not found: {0}".format(graph_name))

    graph = get_blueprint_event_graph(blueprint)
    if not graph:
        raise ValueError(
            "Blueprint does not expose an event graph in this UE4.25 environment."
        )

    return blueprint, graph


def _find_component_class(blueprint, component_name):
    component_node, component_template = get_component_template(blueprint, component_name)
    return component_node, component_template, component_template.get_class()


def _result_for_node(blueprint, graph, node):
    finalize_blueprint_change(blueprint, structural=True)
    return {
        "success": True,
        "node": serialize_graph_node(node, get_object_name(graph)),
    }


def _build_pin_type(variable_type_name):
    pin_type_class = getattr(unreal, "EdGraphPinType", None)
    if not pin_type_class:
        raise ValueError(
            "EdGraphPinType is not exposed in this UE4.25 Python environment."
        )

    pin_type = pin_type_class()
    variable_type_lower = str(variable_type_name or "").strip().lower()

    struct_types = {
        "vector": unreal.Vector.static_struct(),
        "rotator": unreal.Rotator.static_struct(),
        "transform": unreal.Transform.static_struct(),
        "linearcolor": unreal.LinearColor.static_struct(),
        "color": unreal.LinearColor.static_struct(),
    }
    primitive_categories = {
        "bool": "bool",
        "boolean": "bool",
        "int": "int",
        "integer": "int",
        "float": "float",
        "real": "float",
        "string": "string",
        "name": "name",
        "text": "text",
    }

    if variable_type_lower in primitive_categories:
        set_object_property(pin_type, "pin_category", primitive_categories[variable_type_lower])
        return pin_type

    if variable_type_lower in struct_types:
        set_object_property(pin_type, "pin_category", "struct")
        set_object_property(pin_type, "pin_subcategory_object", struct_types[variable_type_lower])
        return pin_type

    if variable_type_lower.startswith("object:"):
        class_name = variable_type_name.split(":", 1)[1]
        object_class = resolve_class_reference(class_name, ["Engine", "UMG"])
        if not object_class:
            raise ValueError("Object variable class not found: {0}".format(class_name))
        set_object_property(pin_type, "pin_category", "object")
        set_object_property(pin_type, "pin_subcategory_object", get_UClass(object_class))
        return pin_type

    raise ValueError("Unsupported blueprint variable type: {0}".format(variable_type_name))
