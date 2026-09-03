def serialize_graph_node(node, graph_name=None):
    pin_data = []
    for pin in list(getattr(node, "pins", []) or []):
        linked_nodes = []
        for linked_pin in list(getattr(pin, "linked_to", []) or []):
            try:
                linked_nodes.append(
                    {
                        "pin": get_pin_name(linked_pin),
                        "node_id": get_node_guid_string(linked_pin.get_owning_node()),
                    }
                )
            except Exception:
                continue

        pin_data.append(
            {
                "name": get_pin_name(pin),
                "direction": unreal_text(get_editor_property_value(pin, "direction", "")),
                "default_value": get_editor_property_value(pin, "default_value", ""),
                "linked_to": linked_nodes,
            }
        )

    return {
        "id": get_node_guid_string(node),
        "name": get_object_name(node),
        "title": get_node_title_text(node),
        "class": get_object_class_name(node),
        "graph": graph_name,
        "pins": pin_data,
    }


def get_blueprint_variable_descriptions(blueprint):
    return list(get_editor_property_value(blueprint, "new_variables", []) or [])


def serialize_pin_type(pin_type):
    if not pin_type:
        return {}

    pin_category = get_editor_property_value(pin_type, "pin_category")
    pin_subcategory = get_editor_property_value(pin_type, "pin_subcategory")
    pin_subcategory_object = get_editor_property_value(
        pin_type, "pin_subcategory_object"
    )
    container_type = get_editor_property_value(pin_type, "container_type")

    result = {
        "pin_category": unreal_text(pin_category or ""),
        "pin_subcategory": unreal_text(pin_subcategory or ""),
        "container_type": unreal_text(container_type or ""),
        "is_reference": bool(get_editor_property_value(pin_type, "is_reference", False)),
        "is_const": bool(get_editor_property_value(pin_type, "is_const", False)),
        "is_weak_pointer": bool(
            get_editor_property_value(pin_type, "is_weak_pointer", False)
        ),
    }

    if pin_subcategory_object:
        result["pin_subcategory_object"] = {
            "name": get_object_name(pin_subcategory_object),
            "class": get_object_class_name(pin_subcategory_object),
        }

    return result


def serialize_blueprint_variable_desc(variable_desc):
    var_name = unreal_text(get_editor_property_value(variable_desc, "var_name", ""))
    friendly_name = unreal_text(
        get_editor_property_value(variable_desc, "friendly_name", var_name)
    )
    category_name = unreal_text(
        get_editor_property_value(variable_desc, "category", "Default")
    )
    default_value = get_editor_property_value(variable_desc, "default_value")
    tooltip = unreal_text(get_editor_property_value(variable_desc, "tooltip", "") or "")
    replication_condition = get_editor_property_value(
        variable_desc, "replication_condition"
    )
    replication_notify = get_editor_property_value(variable_desc, "rep_notify_func")

    return {
        "name": var_name,
        "friendly_name": friendly_name,
        "category": category_name,
        "tooltip": tooltip,
        "default_value": default_value,
        "pin_type": serialize_pin_type(get_editor_property_value(variable_desc, "var_type")),
        "property_flags": int(get_editor_property_value(variable_desc, "property_flags", 0) or 0),
        "replication_condition": unreal_text(replication_condition or ""),
        "rep_notify_func": unreal_text(replication_notify or ""),
    }


def get_blueprint_function_graphs(blueprint):
    return list(get_editor_property_value(blueprint, "function_graphs", []) or [])


def get_graph_edges(graph):
    edges = []
    seen_edges = set()

    for node in get_graph_nodes(graph):
        node_id = get_node_guid_string(node)
        for pin in list(getattr(node, "pins", []) or []):
            source_pin_name = get_pin_name(pin)
            for linked_pin in list(getattr(pin, "linked_to", []) or []):
                try:
                    target_node = linked_pin.get_owning_node()
                    target_node_id = get_node_guid_string(target_node)
                except Exception:
                    continue

                edge_key = (
                    node_id,
                    source_pin_name,
                    target_node_id,
                    get_pin_name(linked_pin),
                )
                if edge_key in seen_edges:
                    continue

                seen_edges.add(edge_key)
                edges.append(
                    {
                        "source_node_id": node_id,
                        "source_pin": source_pin_name,
                        "target_node_id": target_node_id,
                        "target_pin": get_pin_name(linked_pin),
                    }
                )

    return edges
