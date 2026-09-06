

OPERATIONS = {
    "get_actors_in_level": get_actors_in_level,
    "find_actors_by_name": find_actors_by_name,
    "spawn_actor": spawn_actor,
    "delete_actor": delete_actor,
    "set_actor_transform": set_actor_transform,
    "get_actor_properties": get_actor_properties,
    "get_actor_material_info": get_actor_material_info,
    "set_actor_property": set_actor_property,
    "spawn_blueprint_actor": spawn_blueprint_actor,
}

dispatch_main("actor tool")
