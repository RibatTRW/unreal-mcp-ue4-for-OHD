def get_actors_in_level(_args):
    world = get_editor_world()
    if not world:
        return {"success": False, "message": "No world loaded", "actors": []}

    actors = [get_actor_summary(actor) for actor in get_all_level_actors()]
    actors.sort(key=lambda actor: actor["label"] or actor["name"])
    return {"success": True, "world_name": world.get_name(), "actors": actors}


def find_actors_by_name(args):
    pattern = unreal_text(args.get("pattern") or "").strip().lower()
    if not pattern:
        return {"success": False, "message": "Pattern is required", "actors": []}

    matching_actors = []
    for actor in get_all_level_actors():
        actor_name = actor.get_name()
        actor_label = actor.get_actor_label()
        if pattern in actor_name.lower() or pattern in actor_label.lower():
            matching_actors.append(
                {
                    "name": actor_name,
                    "label": actor_label,
                    "class": actor.get_class().get_name(),
                }
            )

    matching_actors.sort(key=lambda actor: actor["label"] or actor["name"])
    return {
        "success": True,
        "pattern": pattern,
        "count": len(matching_actors),
        "actors": matching_actors,
    }


def get_actor_properties(args):
    actor_name = args.get("name")
    actor = find_actor_by_name(actor_name)
    if not actor:
        return {
            "success": False,
            "message": "Actor not found: {0}".format(actor_name),
        }

    return {"success": True, "actor": get_actor_property_report(actor)}


def get_actor_material_info(args):
    actor_name = args.get("name")
    actor = find_actor_by_name(actor_name)
    if not actor:
        return {
            "success": False,
            "message": "Actor not found: {0}".format(actor_name),
        }

    return {"success": True, "materials": get_actor_material_report(actor)}
