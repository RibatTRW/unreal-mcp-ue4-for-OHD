

OPERATIONS = {
    "create_blueprint": create_blueprint,
    "add_component_to_blueprint": add_component_to_blueprint,
    "set_static_mesh_properties": set_static_mesh_properties,
    "set_component_property": set_component_property,
    "set_physics_properties": set_physics_properties,
    "compile_blueprint": compile_blueprint,
    "set_blueprint_property": set_blueprint_property,
}

dispatch_main("blueprint tool")
