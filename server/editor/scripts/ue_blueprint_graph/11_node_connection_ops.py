def connect_blueprint_nodes(args):
    blueprint_name = args.get("blueprint_name")
    source_node_id = args.get("source_node_id")
    source_pin_name = args.get("source_pin")
    target_node_id = args.get("target_node_id")
    target_pin_name = args.get("target_pin")

    try:
        blueprint = load_blueprint_asset(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    source_graph, source_node = find_blueprint_graph_node(blueprint, source_node_id)
    target_graph, target_node = find_blueprint_graph_node(blueprint, target_node_id)
    if not source_node or not target_node:
        return {
            "success": False,
            "message": "Could not find both graph nodes by id.",
        }

    source_pin = find_node_pin(source_node, source_pin_name)
    target_pin = find_node_pin(target_node, target_pin_name)
    if not source_pin or not target_pin:
        return {
            "success": False,
            "message": "Could not find both graph pins for the requested connection.",
        }

    try:
        source_pin.make_link_to(target_pin)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    finalize_blueprint_change(blueprint, structural=True)
    return {
        "success": True,
        "source": {
            "graph": get_object_name(source_graph),
            "node_id": get_node_guid_string(source_node),
            "pin": source_pin_name,
        },
        "target": {
            "graph": get_object_name(target_graph),
            "node_id": get_node_guid_string(target_node),
            "pin": target_pin_name,
        },
    }


def connect_nodes(args):
    args = dict(args or {})
    args["source_node_id"] = args.get("source_node_id") or args.get("source_node")
    args["target_node_id"] = args.get("target_node_id") or args.get("target_node")
    return connect_blueprint_nodes(args)


def disconnect_nodes(args):
    blueprint_name = args.get("blueprint_name")
    source_node_id = args.get("source_node_id") or args.get("source_node")
    source_pin_name = args.get("source_pin")
    target_node_id = args.get("target_node_id") or args.get("target_node")
    target_pin_name = args.get("target_pin")

    try:
        blueprint = load_blueprint_asset(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    source_graph, source_node = find_blueprint_graph_node(blueprint, source_node_id)
    if not source_node:
        return {"success": False, "message": "Could not find source node."}

    source_pin = find_node_pin(source_node, source_pin_name)
    if not source_pin:
        return {"success": False, "message": "Could not find source pin."}

    target_pin = None
    target_graph = None
    target_node = None
    if target_node_id and target_pin_name:
        target_graph, target_node = find_blueprint_graph_node(blueprint, target_node_id)
        if not target_node:
            return {"success": False, "message": "Could not find target node."}
        target_pin = find_node_pin(target_node, target_pin_name)
        if not target_pin:
            return {"success": False, "message": "Could not find target pin."}

    try:
        broken_links = break_pin_links(source_pin, target_pin)
        finalize_blueprint_change(blueprint, structural=True)
        return {
            "success": True,
            "broken_links": broken_links,
            "source": {
                "graph": get_object_name(source_graph),
                "node_id": get_node_guid_string(source_node),
                "pin": source_pin_name,
            },
            "target": {
                "graph": get_object_name(target_graph) if target_graph else None,
                "node_id": get_node_guid_string(target_node) if target_node else None,
                "pin": target_pin_name,
            },
        }
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}
